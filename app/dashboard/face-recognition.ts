// This service handles communication with the Python facial recognition API

export interface RecognitionResult {
    isMatch: boolean
    confidence: number
    personId?: string
    error?: string
    debug?: any // For debugging information
  }
  
  export async function compareFaces(
    sourceImageUrl: string,
    targetImageUrls: { id: string; url: string }[],
  ): Promise<RecognitionResult> {
    console.log("Comparing face in captured image with", targetImageUrls.length, "known faces")
    
    // Debug information to collect
    const debugInfo: any = {
      targetCount: targetImageUrls.length,
      targetUrls: targetImageUrls.map(t => t.url),
      apiEndpoint: "https://facial-recognition-api-4gg7.onrender.com/api/compare-faces",
      sourceImageType: sourceImageUrl.startsWith("data:image") ? "data-url" : "remote-url",
      steps: []
    }
  
    try {
      // If no target images, return no match immediately
      if (targetImageUrls.length === 0) {
        console.warn("No target images provided for comparison")
        return {
          isMatch: false,
          confidence: 0,
          error: "No known faces to compare against"
        }
      }
  
      // For the Python API, we need to convert the image URL to base64
      // If sourceImageUrl is already a data URL (starts with data:image), use it directly
      let capturedImageBase64 = sourceImageUrl
  
      // If it's a URL to an image (not a data URL), fetch it and convert to base64
      if (!sourceImageUrl.startsWith("data:image")) {
        debugInfo.steps.push("Converting remote URL to base64")
        try {
          const response = await fetch(sourceImageUrl)
          if (!response.ok) {
            throw new Error(`Failed to fetch source image: ${response.status} ${response.statusText}`)
          }
          const blob = await response.blob()
          capturedImageBase64 = await convertBlobToBase64(blob)
          debugInfo.steps.push("Successfully converted remote URL to base64")
        } catch (fetchError) {
          console.error("Error fetching source image:", fetchError)
          debugInfo.steps.push(`Error fetching source image: ${fetchError.message}`)
          return {
            isMatch: false,
            confidence: 0,
            error: "Failed to load source image for comparison",
            debug: debugInfo
          }
        }
      } else {
        debugInfo.steps.push("Source image is already in base64 format")
      }
  
      // Process target URLs - ensure they're all accessible
      debugInfo.steps.push("Processing target URLs")
      const databaseUrls = []
      
      for (const target of targetImageUrls) {
        if (!target.url) {
          console.warn("Target missing URL:", target)
          continue
        }
        
        // Check if URL is valid
        try {
          new URL(target.url)
          databaseUrls.push(target.url)
        } catch (e) {
          console.warn("Invalid target URL:", target.url)
          debugInfo.steps.push(`Skipping invalid URL: ${target.url}`)
        }
      }
      
      if (databaseUrls.length === 0) {
        console.warn("No valid target URLs after filtering")
        return {
          isMatch: false,
          confidence: 0,
          error: "No valid known face images found",
          debug: debugInfo
        }
      }
      
      debugInfo.validTargetCount = databaseUrls.length
      debugInfo.steps.push(`Found ${databaseUrls.length} valid target URLs`)
  
      // Prepare the request payload
      const payload = {
        capturedImage: capturedImageBase64,
        databaseUrls: databaseUrls,
      }
      
      debugInfo.steps.push("Sending request to facial recognition API")
      console.log("Sending request to facial recognition API with", databaseUrls.length, "target URLs")
      
      // Call the Python API with a timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout
      
      try {
        const response = await fetch("https://facial-recognition-api-4gg7.onrender.com/api/compare-faces", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
          signal: controller.signal
        })
        
        clearTimeout(timeoutId)
        
        if (!response.ok) {
          const errorText = await response.text().catch(() => "Could not read error response");
          debugInfo.steps.push(`API responded with error: ${response.status} ${response.statusText}`)
          debugInfo.errorResponse = errorText
          throw new Error(`API responded with status: ${response.status} - ${errorText}`)
        }
  
        const result = await response.json()
        debugInfo.apiResponse = result
        debugInfo.steps.push("Received response from API")
        console.log("Face recognition API response:", result)
  
        // If a match was found
        if (result.matchFound) {
          // Find which person ID corresponds to the matched URL
          const matchedUrl = result.matchedImageUrl
          debugInfo.steps.push(`Match found with URL: ${matchedUrl}`)
          
          const matchedTarget = targetImageUrls.find((target) => target.url === matchedUrl)
          
          if (!matchedTarget) {
            console.warn("Matched URL not found in original targets:", matchedUrl)
            debugInfo.steps.push("Warning: Matched URL not found in original targets")
          }
  
          return {
            isMatch: true,
            confidence: result.confidence || 0.85, // Use API confidence if available, otherwise default
            personId: matchedTarget?.id,
            debug: debugInfo
          }
        } else {
          // No match found
          debugInfo.steps.push("No match found by the API")
          return {
            isMatch: false,
            confidence: 0,
            debug: debugInfo
          }
        }
      } catch (fetchError) {
        if (fetchError.name === 'AbortError') {
          console.error("API request timed out after 30 seconds")
          debugInfo.steps.push("API request timed out after 30 seconds")
          return {
            isMatch: false,
            confidence: 0,
            error: "Face recognition service timed out. Please try again.",
            debug: debugInfo
          }
        }
        
        throw fetchError // Re-throw to be caught by outer catch
      }
    } catch (error) {
      //console.error("Error in face comparison:", error)
      debugInfo.steps.push(`Error: ${error.message}`)
      // Return a graceful failure with debug info
      return {
        isMatch: false,
        confidence: 0,
        error: "Failed to compare faces. Please try again.",
        debug: debugInfo
      }
    }
  }
  
  // Helper function to convert a Blob to base64
  function convertBlobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  }
  