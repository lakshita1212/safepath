"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Phone,
  User,
  Camera,
  Upload,
  CheckCircle,
  AlertTriangle,
  UserPlus,
  LogOut,
  MapPin,
  Clock,
  Home,
  Calendar,
} from "lucide-react"
import { compareFaces } from "./face-recognition"
import MapComponent from "./MapComponent"
import { useRouter } from "next/navigation"
import ChatBot from "../components/ChatBot"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { FormLabel } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { supabase } from "../supabaseConfig"
import { toast } from "sonner"

interface UserType {
  id: string
  email: string
  patient_name: string
  patient_photo_url: string | null
  base_latitude?: number
  base_longitude?: number
  radius?: number
  base_address?: string
}

interface KnownPerson {
  id: string
  name: string
  phone: string
  relationship: string
  photo_url: string | null
  supabase_img_url?: string | null
  is_emergency_contact: boolean
  details?: string
}

interface NewPerson {
  name: string
  relationship: string
  details: string
}

// Mock database of known people
const initialKnownPeople = [
  {
    id: 1,
    name: "Jane Smith",
    relationship: "Daughter",
    details: "Lives nearby and visits on weekends",
    imageUrl: "/placeholder.svg",
  },
  {
    id: 2,
    name: "Robert Johnson",
    relationship: "Son",
    details: "Lives in the city and visits monthly",
    imageUrl: "/placeholder.svg",
  },
  {
    id: 3,
    name: "Dr. Williams",
    relationship: "Doctor",
    details: "Visits every Tuesday for check-ups",
    imageUrl: "/placeholder.svg",
  },
]

export default function DashboardPage() {
  const router = useRouter()
  const [patientStatus, setPatientStatus] = useState("safe") // safe, warning, alert
  const [showIdentityDialog, setShowIdentityDialog] = useState(false)
  const [showRecognitionDialog, setShowRecognitionDialog] = useState(false)
  const [showAddPersonDialog, setShowAddPersonDialog] = useState(false)
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [isUsingCamera, setIsUsingCamera] = useState(false)
  const [isMapVisible, setIsMapVisible] = useState(true)
  const [userData, setUserData] = useState<UserType | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  // Add the missing baseAddress state
  const [baseAddress, setBaseAddress] = useState<string>("Loading...")

  const [recognitionResult, setRecognitionResult] = useState<{
    isRecognized: boolean
    person?: (typeof initialKnownPeople)[0]
  } | null>(null)
  const [knownPeople, setKnownPeople] = useState(initialKnownPeople)
  const [newPerson, setNewPerson] = useState({
    name: "",
    relationship: "",
    details: "",
  })
  const [currentDistance, setCurrentDistance] = useState(320)

  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // Add a new state to track location history
  const [locationHistory, setLocationHistory] = useState<
    Array<{
      time: Date
      location: { lat: number; lng: number }
      distance: number
      description: string
    }>
  >([])

  // Add a new state to track face recognition errors
  const [recognitionError, setRecognitionError] = useState<string | null>(null)

  useEffect(() => {
    loadUserData()
  }, [])

  // Add this useEffect to handle camera cleanup properly
  useEffect(() => {
    // Clean up camera when dialog closes
    if (!showRecognitionDialog && streamRef.current) {
      stopCamera()
    }

    // Clean up on component unmount
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
      }
    }
  }, [showRecognitionDialog])

  // Add this useEffect to ensure the camera is properly initialized when the dialog opens
  // Add this near your other useEffect hooks
  useEffect(() => {
    // Initialize camera when dialog opens and camera is requested
    if (showRecognitionDialog && !capturedImage && !recognitionResult) {
      console.log("Dialog opened, initializing camera...")
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        if (videoRef.current) {
          checkCameraAvailability().then((hasCamera) => {
            if (hasCamera) {
              startCamera()
            }
          })
        } else {
          //console.error("Video element not available after delay")
          //toast.error("Could not initialize camera - video element not found")
        }
      }, 500)

      return () => clearTimeout(timer)
    }
  }, [showRecognitionDialog, capturedImage, recognitionResult])

  const loadUserData = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push("/login")
        return
      }

      // Get user data from users table
      const { data: userData, error: userError } = await supabase.from("users").select("*").eq("id", user.id).single()

      if (userError) throw userError

      if (userData) {
        setUserData(userData)

        // Set base address from user data if available
        if (userData.base_address) {
          setBaseAddress(userData.base_address)
        } else if (userData.base_latitude && userData.base_longitude) {
          try {
            // If no base_address but coordinates are available, fetch address from coordinates
            const response = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${userData.base_latitude}&lon=${userData.base_longitude}&zoom=18&addressdetails=1`,
            )
            const data = await response.json()

            if (data && data.display_name) {
              setBaseAddress(data.display_name)
            } else {
              setBaseAddress(`${userData.base_latitude.toFixed(6)}, ${userData.base_longitude.toFixed(6)}`)
            }
          } catch (error) {
            //console.error("Error getting address from coordinates:", error)
            setBaseAddress(`${userData.base_latitude.toFixed(6)}, ${userData.base_longitude.toFixed(6)}`)
          }
        } else {
          setBaseAddress("No base location set")
        }

        loadKnownPeople(user.id)
      }
    } catch (error) {
      //console.error("Error loading user:", error)
      toast.error("Failed to load user data")
      setIsLoading(false)
    }
  }

  // Load known people from localStorage on component mount
  useEffect(() => {
    const storedPeople = localStorage.getItem("knownPeople")
    if (storedPeople) {
      try {
        setKnownPeople(JSON.parse(storedPeople))
      } catch (e) {
        //console.error("Error parsing stored people:", e)
      }
    }
  }, [])

  // Save known people to localStorage when it changes
  useEffect(() => {
    localStorage.setItem("knownPeople", JSON.stringify(knownPeople))
  }, [knownPeople])

  // Clean up camera stream when component unmounts
  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [])

  const loadKnownPeople = async (userId: string) => {
    try {
      const { data, error } = await supabase.from("Known_People").select("*").eq("user_id", userId)

      if (error) {
        //console.error("Supabase error:", error)
        toast.error(`Failed to load known people: ${error.message}`)
        return
      }

      if (data) {
        setKnownPeople(data)
      }
    } catch (error) {
      //console.error("Error loading known people:", error)
      toast.error("Failed to load known people")
    } finally {
      setIsLoading(false)
    }
  }

  const getEmergencyContacts = () => {
    return knownPeople.filter((person) => person.is_emergency_contact)
  }

  // Replace the startCamera function with this improved version that sets proper video constraints
  const startCamera = async () => {
    try {
      // Show loading state
      toast.loading("Accessing camera...")

      // First check if video element exists
      if (!videoRef.current) {
        toast.dismiss()
        toast.error("Video element not available")
        return
      }

      // Check if browser supports getUserMedia
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        toast.dismiss()
        toast.error("Your browser doesn't support camera access")
        return
      }

      // Request camera with specific constraints for better compatibility and proper dimensions
      const constraints = {
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "user",
        },
        audio: false,
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints)

      // Dismiss loading toast
      toast.dismiss()

      // Store the stream reference first
      streamRef.current = stream

      // Then set the stream to the video element
      videoRef.current.srcObject = stream

      // Make sure the video plays when it's ready
      videoRef.current.onloadedmetadata = () => {
        if (videoRef.current) {
          videoRef.current.play().catch((err) => {
            console.error("Error playing video:", err)
            toast.error("Could not start video stream")
          })
        }
      }

      setIsUsingCamera(true)
      toast.success("Camera activated")
    } catch (err) {
      //console.error("Error accessing camera:", err)
      toast.dismiss()

      // Provide more specific error messages based on the error
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        toast.error("Camera access denied. Please allow camera access in your browser settings.")
      } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        toast.error("No camera found. Please connect a camera and try again.")
      } else if (err.name === "NotReadableError" || err.name === "TrackStartError") {
        toast.error("Camera is in use by another application or not accessible.")
      } else if (err.name === "OverconstrainedError") {
        toast.error("Camera doesn't meet the required constraints. Try a different camera.")
      } else {
        toast.error(`Camera error: ${err.message || "Unknown error"}`)
      }
    }
  }

  // Replace the stopCamera function with this improved version
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.stop()
      })
      streamRef.current = null

      // Clear the video source
      if (videoRef.current) {
        videoRef.current.srcObject = null
      }
    }
    setIsUsingCamera(false)
  }

  // Replace the capturePhoto function with this improved version that maintains proper dimensions
  const capturePhoto = () => {
    if (!videoRef.current) {
      toast.error("Camera not initialized")
      return
    }

    try {
      const video = videoRef.current

      // Make sure the video is playing and has dimensions
      if (video.readyState !== 4 || video.videoWidth === 0 || video.videoHeight === 0) {
        toast.error("Video stream not ready yet. Please wait a moment and try again.")
        return
      }

      // Create a canvas with the SAME dimensions as the video
      const canvas = document.createElement("canvas")

      // Use the actual video dimensions to maintain aspect ratio
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight

      console.log(`Capturing photo at ${canvas.width}x${canvas.height}`)

      const ctx = canvas.getContext("2d")
      if (!ctx) {
        toast.error("Could not create canvas context")
        return
      }

      // Draw the video frame to the canvas
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

      // Get the image data at full quality
      try {
        const image = canvas.toDataURL("image/png", 1.0)
        setCapturedImage(image)
        stopCamera()
        toast.success("Photo captured successfully")
      } catch (err) {
        console.error("Error converting canvas to image:", err)
        toast.error("Failed to capture photo")
      }
    } catch (err) {
      console.error("Error capturing photo:", err)
      toast.error("Failed to capture photo")
    }
  }

  // Add this function to check if the camera is available
  const checkCameraAvailability = async () => {
    try {
      // First check if the browser supports getUserMedia
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        toast.error("Your browser doesn't support camera access")
        return false
      }

      const devices = await navigator.mediaDevices.enumerateDevices()
      const videoDevices = devices.filter((device) => device.kind === "videoinput")

      if (videoDevices.length === 0) {
        toast.error("No camera detected on your device")
        return false
      }
      return true
    } catch (err) {
      console.error("Error checking camera availability:", err)
      toast.error("Could not check camera availability")
      return false
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader()
      reader.onload = (event) => {
        if (event.target?.result) {
          setCapturedImage(event.target.result as string)
        }
      }
      reader.readAsDataURL(e.target.files[0])
    }
  }

  // Then, update the recognizePerson function to handle errors from the face recognition service
  const recognizePerson = async () => {
    if (!capturedImage || !userData?.id) {
      toast.error("No image captured or user data missing")
      return
    }

    try {
      // Show loading state
      toast.loading("Analyzing image...")
      setRecognitionError(null)

      // Check if we have known people to compare against
      const { data: knownPeopleData, error: knownPeopleError } = await supabase
        .from("Known_People")
        .select("*")
        .eq("user_id", userData.id)

      if (knownPeopleError) {
        console.error("Error fetching known people:", knownPeopleError)
        toast.dismiss()
        toast.error("Failed to fetch known people data")
        return
      }

      // Filter people with photos and prepare for face comparison
      const peopleWithPhotos = knownPeopleData.filter((person) => person.photo_url || person.supabase_img_url)

      if (peopleWithPhotos.length === 0) {
        toast.dismiss()
        toast.info("No known people with photos to compare against")
        setRecognitionResult({
          isRecognized: false,
        })
        return
      }

      // Try to upload the image to Supabase storage
      try {
        // First, convert the captured image to a File object
        const capturedImageFile = await dataURLtoFile(capturedImage, `recognition-${Date.now()}.png`)

        console.log(
          `Uploading file: ${capturedImageFile.name}, size: ${capturedImageFile.size} bytes, type: ${capturedImageFile.type}`,
        )

        // Check if file size is reasonable (less than 5MB)
        if (capturedImageFile.size > 5 * 1024 * 1024) {
          // If image is too large, resize it before uploading
          toast.info("Image is large, optimizing for upload...")
          // For now, we'll just proceed with the original image
        }

        // Upload to Supabase storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("person-attachments")
          .upload(`recognition/${userData.id}/${Date.now()}.png`, capturedImageFile)

        if (uploadError) {
          //console.error("Error uploading image to Supabase:", uploadError)
          // Continue with face recognition using the data URL directly
          console.log("Proceeding with face recognition using data URL directly")
        } else {
          console.log("Image uploaded successfully to Supabase:", uploadData.path)
        }
      } catch (uploadErr) {
        //console.error("Exception during image upload:", uploadErr)
        // Continue with face recognition using the data URL directly
      }

      // Prepare the target images for comparison
      const targetImages = peopleWithPhotos.map((person) => ({
        id: person.id,
        url: person.photo_url || person.supabase_img_url,
      }))

      // Use the face recognition service to compare faces
      // We'll pass the capturedImage directly as a data URL
      const recognitionResult = await compareFaces(capturedImage, targetImages)

      toast.dismiss()

      // Check if there was an error in the face recognition service
      if (recognitionResult.error) {
        setRecognitionError(recognitionResult.error)
        toast.error(recognitionResult.error)
        setRecognitionResult({
          isRecognized: false,
        })
        return
      }

      if (recognitionResult.isMatch && recognitionResult.personId) {
        // Find the matched person in our known people data
        const matchedPerson = peopleWithPhotos.find((person) => person.id === recognitionResult.personId)

        if (matchedPerson) {
          toast.success(
            `Recognized: ${matchedPerson.name} (${Math.round(recognitionResult.confidence * 100)}% confidence)`,
          )
          setRecognitionResult({
            isRecognized: true,
            person: matchedPerson,
          })
        } else {
          // This shouldn't happen, but handle it just in case
          toast.error("Matched person not found in database")
          setRecognitionResult({
            isRecognized: false,
          })
        }
      } else {
        toast.info("Person not recognized")
        setRecognitionResult({
          isRecognized: false,
        })
      }
    } catch (error) {
      console.error("Error in recognition process:", error)
      toast.dismiss()
      toast.error("An error occurred during recognition")
      setRecognitionError("Failed to process recognition request. Please try again.")
      setRecognitionResult({
        isRecognized: false,
      })
    }
  }

  // Add this helper function to convert data URL to File object
  const dataURLtoFile = (dataurl: string, filename: string): File => {
    try {
      // Check if it's a valid data URL
      if (!dataurl.startsWith("data:")) {
        throw new Error("Invalid data URL format")
      }

      // Split the data URL to get the MIME type and base64 data
      const arr = dataurl.split(",")
      if (arr.length !== 2) {
        throw new Error("Invalid data URL format")
      }

      // Extract the MIME type
      const mimeMatch = arr[0].match(/:(.*?);/)
      if (!mimeMatch) {
        throw new Error("Could not extract MIME type from data URL")
      }
      const mime = mimeMatch[1]

      // Decode the base64 data
      const bstr = atob(arr[1])
      let n = bstr.length
      const u8arr = new Uint8Array(n)

      while (n--) {
        u8arr[n] = bstr.charCodeAt(n)
      }

      console.log(`Creating file with MIME type: ${mime}, size: ${u8arr.length} bytes`)
      return new File([u8arr], filename, { type: mime })
    } catch (error) {
      console.error("Error converting data URL to file:", error)
      throw error
    }
  }

  const handleAddPerson = () => {
    if (newPerson.name && newPerson.relationship) {
      const person = {
        id: Date.now(),
        name: newPerson.name,
        relationship: newPerson.relationship,
        details: newPerson.details,
        imageUrl: capturedImage || "/placeholder.svg",
      }

      setKnownPeople([...knownPeople, person])
      setRecognitionResult({
        isRecognized: true,
        person,
      })
      setShowAddPersonDialog(false)
      setNewPerson({ name: "", relationship: "", details: "" })
    }
  }

  const resetRecognition = () => {
    setCapturedImage(null)
    setRecognitionResult(null)
  }

  const handleEmergencyCall = () => {
    const emergencyContacts = knownPeople.filter(
      (person) =>
        person.relationship.toLowerCase().includes("emergency") || person.relationship.toLowerCase().includes("doctor"),
    )

    if (emergencyContacts.length > 0) {
      // In a real app, this would initiate a call
      toast.info(`Calling emergency contact: ${emergencyContacts[0].name}`)
    } else {
      toast.error("No emergency contacts found")
    }
  }

  const handleCallPerson = (person: any) => {
    alert(`Calling ${person?.name}...`)
    // In a real app, this would initiate a call
  }

  const handleLogout = () => {
    // In a real app, you would clear authentication tokens, cookies, etc.
    // For this demo, we'll just navigate to the home page
    router.push("/")
  }

  // Add this function to the component if it doesn't exist
  const refreshLocation = () => {
    // This would trigger a location refresh
    // For now, we'll just show a toast
    toast.info("Refreshing location data...")

    // In a real implementation, you would call the MapComponent's refresh method
    // or trigger a new location fetch
  }

  // Add this useEffect to initialize camera when dialog opens
  useEffect(() => {
    if (showRecognitionDialog && isUsingCamera && !streamRef.current) {
      const initCamera = async () => {
        const hasCamera = await checkCameraAvailability()
        if (hasCamera) {
          startCamera()
        }
      }
      initCamera()
    }
  }, [showRecognitionDialog, isUsingCamera])

  return (
    <div className="container py-6">
      <div className="flex flex-col space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="pl-6">
            <h1 className="text-3xl font-bold">Patient Dashboard</h1>
            <p className="text-muted-foreground">Monitor and manage your patient's location</p>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setShowIdentityDialog(true)
                setIsMapVisible(false)
              }}
            >
              <User className="mr-2 h-4 w-4" />
              Who am I?
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setShowRecognitionDialog(true)
                resetRecognition()
                setIsMapVisible(false) // Hide map when dialog opens
              }}
            >
              <UserPlus className="mr-2 h-4 w-4" />
              Who is this?
            </Button>
            <Button variant="outline" size="sm" onClick={handleEmergencyCall}>
              <Phone className="mr-2 h-4 w-4" />
              Emergency Call
            </Button>
            <Button variant="destructive" size="sm" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="md:col-span-2">
            <CardHeader className="pb-2">
              <div className="flex justify-between items-center">
                <CardTitle>Location Tracking</CardTitle>
                <Badge
                  variant={
                    patientStatus === "safe" ? "outline" : patientStatus === "warning" ? "secondary" : "destructive"
                  }
                >
                  {patientStatus === "safe"
                    ? "Within Safe Zone"
                    : patientStatus === "warning"
                      ? "Near Boundary"
                      : "Outside Safe Zone"}
                </Badge>
              </div>
              <CardDescription>Current location and movement history</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-hidden h-[400px]">
                {isMapVisible && (
                  <div
                    className="relative w-full h-full map-container"
                    style={{
                      visibility: isMapVisible ? "visible" : "hidden",
                      position: isMapVisible ? "relative" : "absolute", // Position set to absolute when hidden
                    }}
                    id="mapComponent"
                  >
                    <MapComponent
                      onLocationUpdate={(location) => {
                        // Update patient status based on distance from base
                        const distance = location.distance
                        setCurrentDistance(distance)

                        // Use the user's actual safe radius if available
                        const safeRadius = userData?.radius || 500

                        if (distance > safeRadius) {
                          setPatientStatus("alert")
                        } else if (distance > safeRadius * 0.8) {
                          // Warning at 80% of safe radius
                          setPatientStatus("warning")
                        } else {
                          setPatientStatus("safe")
                        }

                        // Add to location history
                        const now = new Date()
                        let description = "Unknown location"

                        // Determine location description based on distance
                        if (distance < 50) {
                          description = "Base Location"
                        } else if (distance < safeRadius * 0.4) {
                          description = "Near Home"
                        } else if (distance < safeRadius * 0.8) {
                          description = "Neighborhood"
                        } else if (distance < safeRadius * 1.2) {
                          description = "Local Area"
                        } else {
                          description = "Far from Home"
                        }

                        // Add new location to history (limit to 20 entries)
                        setLocationHistory((prev) => {
                          // Only add if position has changed significantly or time difference > 5 minutes
                          const lastEntry = prev[0]
                          if (lastEntry) {
                            const timeDiff = now.getTime() - lastEntry.time.getTime()
                            const positionDiff = Math.abs(lastEntry.distance - distance)

                            if (timeDiff < 5 * 60 * 1000 && positionDiff < 50) {
                              return prev // Don't add if too similar to last entry
                            }
                          }

                          const newEntry = {
                            time: now,
                            location: { lat: location.lat, lng: location.lng },
                            distance: Math.round(distance),
                            description,
                          }

                          return [newEntry, ...prev].slice(0, 20)
                        })
                      }}
                      safeRadius={userData?.radius || 500}
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Patient Information</CardTitle>
              <CardDescription>Details and status</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={userData?.patient_photo_url || ""} />
                  <AvatarFallback>{userData?.patient_name?.charAt(0) || "P"}</AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-medium">{userData?.patient_name || "Patient Name"}</h3>
                  <p className="text-sm text-muted-foreground">ID: #{userData?.id?.slice(-8) || "Unknown"}</p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Status:</p>
                <div className="flex items-center space-x-2">
                  <Badge
                    variant={
                      patientStatus === "safe" ? "default" : patientStatus === "warning" ? "default" : "destructive"
                    }
                  >
                    {patientStatus === "safe"
                      ? "Within Safe Zone"
                      : patientStatus === "warning"
                        ? "Near Boundary"
                        : "Outside Safe Zone"}
                  </Badge>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Base Location:</p>
                <p className="text-sm text-muted-foreground break-words">{baseAddress}</p>
                {userData?.base_latitude && userData?.base_longitude && (
                  <p className="text-xs text-muted-foreground"></p>
                )}
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Safe Radius:</p>
                <p className="text-sm text-muted-foreground">{userData?.radius || 500} meters</p>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Emergency Contacts:</p>
                <div className="space-y-2">
                  {getEmergencyContacts().map((contact) => (
                    <div key={contact.id} className="flex items-center justify-between p-2 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={contact.photo_url || undefined} />
                          <AvatarFallback>{contact.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">{contact.name}</p>
                          <p className="text-xs text-muted-foreground">{contact.phone}</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => handleCallPerson(contact)} className="h-8 w-8">
                        <Phone className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  {getEmergencyContacts().length === 0 && (
                    <p className="text-sm text-muted-foreground">No emergency contacts designated</p>
                  )}
                </div>
              </div>

              <Button
                className="w-full"
                variant="outline"
                onClick={() => {
                  setShowIdentityDialog(true)
                  setIsMapVisible(false)
                }}
              >
                Edit Patient Details
              </Button>
            </CardContent>
          </Card>
        </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Activity History</CardTitle>
            <CardDescription>Patient movement patterns and location alerts</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="today">
              <TabsList className="mb-4">
                <TabsTrigger value="today">Today</TabsTrigger>
                <TabsTrigger value="week">This Week</TabsTrigger>
                <TabsTrigger value="month">This Month</TabsTrigger>
              </TabsList>
              <TabsContent value="today" className="space-y-4">
                {locationHistory.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <MapPin className="h-12 w-12 text-muted-foreground mb-2 opacity-20" />
                    <p className="text-muted-foreground">
                      No activity recorded today. Location updates will appear here as the patient moves.
                    </p>
                    <Button variant="outline" size="sm" className="mt-4" onClick={() => refreshLocation?.()}>
                      Refresh Location Data
                    </Button>
                  </div>
                ) : (
                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <div>
                        <h4 className="text-sm font-medium">Latest Status</h4>
                        <div className="flex items-center mt-1">
                          <Badge
                            variant={
                              patientStatus === "safe"
                                ? "outline"
                                : patientStatus === "warning"
                                  ? "secondary"
                                  : "destructive"
                            }
                            className="mr-2"
                          >
                            {patientStatus === "safe" ? "Safe" : patientStatus === "warning" ? "Warning" : "Alert"}
                          </Badge>
                          <span className="text-sm text-muted-foreground">{currentDistance} meters from base</span>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => refreshLocation?.()}>
                        <Clock className="h-4 w-4 mr-2" />
                        Refresh
                      </Button>
                    </div>

                    <div className="space-y-4">
                      {locationHistory.map((entry, index) => {
                        // Determine status based on distance
                        const safeRadius = userData?.radius || 500
                        let status = "safe"
                        let statusColor = "bg-green-500"

                        if (entry.distance > safeRadius) {
                          status = "alert"
                          statusColor = "bg-red-500"
                        } else if (entry.distance > safeRadius * 0.8) {
                          status = "warning"
                          statusColor = "bg-amber-500"
                        }

                        // Format time
                        const formattedTime = entry.time.toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })

                        // Format date if not today
                        const isToday = new Date().toDateString() === entry.time.toDateString()
                        const dateDisplay = isToday
                          ? formattedTime
                          : `${entry.time.toLocaleDateString([], { month: "short", day: "numeric" })} ${formattedTime}`

                        return (
                          <div
                            key={entry.time.getTime()}
                            className={`border-l-2 ${index === 0 ? "border-primary" : "border-muted"} pl-4 ml-2 relative`}
                          >
                            <div
                              className={`absolute w-3 h-3 ${statusColor} rounded-full -left-[7px] top-1 border-2 border-white dark:border-gray-800`}
                            ></div>

                            <div className="flex justify-between items-start">
                              <div>
                                <div className="flex items-center">
                                  <p className="font-medium">{dateDisplay}</p>
                                  {index === 0 && (
                                    <Badge variant="outline" className="ml-2 bg-primary/10">
                                      Latest
                                    </Badge>
                                  )}
                                </div>

                                <div className="flex items-center mt-1">
                                  {entry.description === "Base Location" && (
                                    <Home className="h-3 w-3 mr-1 text-muted-foreground" />
                                  )}
                                  {entry.description === "Far from Home" && (
                                    <AlertTriangle className="h-3 w-3 mr-1 text-amber-500" />
                                  )}
                                  <p className="text-sm">
                                    {entry.description}
                                    {entry.description === "Far from Home" &&
                                      status === "alert" &&
                                      " - Outside Safe Zone"}
                                  </p>
                                </div>

                                <div className="flex flex-wrap gap-2 mt-2">
                                  <span className="text-xs bg-muted px-2 py-1 rounded-md">
                                    {entry.distance}m from base
                                  </span>
                                  {entry.distance > safeRadius && (
                                    <span className="text-xs bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300 px-2 py-1 rounded-md">
                                      {Math.round(entry.distance - safeRadius)}m beyond safe radius
                                    </span>
                                  )}
                                  {entry.distance <= safeRadius && (
                                    <span className="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 px-2 py-1 rounded-md">
                                      {Math.round(safeRadius - entry.distance)}m within safe radius
                                    </span>
                                  )}
                                </div>
                              </div>

                              {index === 0 && status === "alert" && (
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  className="shrink-0"
                                  onClick={handleEmergencyCall}
                                >
                                  <Phone className="h-3 w-3 mr-1" />
                                  Call
                                </Button>
                              )}
                            </div>

                            {index === 0 && status === "alert" && (
                              <Alert variant="destructive" className="mt-2">
                                <AlertTriangle className="h-4 w-4" />
                                <AlertDescription>
                                  Patient is outside their safe zone. Consider checking in.
                                </AlertDescription>
                              </Alert>
                            )}
                          </div>
                        )
                      })}
                    </div>

                    {locationHistory.length > 5 && (
                      <Button variant="ghost" className="w-full mt-4" size="sm">
                        View All Activity
                      </Button>
                    )}
                  </div>
                )}
              </TabsContent>
              <TabsContent value="week">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium">Weekly Summary</h4>
                    <Badge variant="outline">
                      {new Date().toLocaleDateString([], { month: "short", day: "numeric" })} -{" "}
                      {new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toLocaleDateString([], {
                        month: "short",
                        day: "numeric",
                      })}
                    </Badge>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Time spent at home:</span>
                      <span className="text-sm font-medium">14 hours 30 minutes</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Longest time away:</span>
                      <span className="text-sm font-medium">3 hours 15 minutes</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Alert incidents:</span>
                      <span className="text-sm font-medium">2 incidents</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Average daily distance:</span>
                      <span className="text-sm font-medium">1.2 km</span>
                    </div>
                  </div>

                  <div className="h-[200px] w-full bg-muted/30 rounded-lg flex items-center justify-center">
                    <p className="text-sm text-muted-foreground">Weekly activity chart will appear here</p>
                  </div>

                  <div className="flex justify-between">
                    <h4 className="text-sm font-medium">Common Locations</h4>
                    <Button variant="ghost" size="sm">
                      View Map
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center p-2 border rounded-md">
                      <Home className="h-4 w-4 mr-2 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Home Base</p>
                        <p className="text-xs text-muted-foreground">{baseAddress.split(",")[0]}</p>
                      </div>
                      <Badge className="ml-auto">80%</Badge>
                    </div>
                    <div className="flex items-center p-2 border rounded-md">
                      <MapPin className="h-4 w-4 mr-2 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Neighborhood Park</p>
                        <p className="text-xs text-muted-foreground">250m from base</p>
                      </div>
                      <Badge className="ml-auto">15%</Badge>
                    </div>
                    <div className="flex items-center p-2 border rounded-md">
                      <MapPin className="h-4 w-4 mr-2 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Local Store</p>
                        <p className="text-xs text-muted-foreground">450m from base</p>
                      </div>
                      <Badge className="ml-auto">5%</Badge>
                    </div>
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="month">
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Calendar className="h-12 w-12 text-muted-foreground mb-2 opacity-20" />
                  <p className="text-muted-foreground">
                    Monthly analytics and patterns will be available in the full version.
                  </p>
                  <Button variant="outline" className="mt-4">
                    Upgrade to Pro
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
        
      </div>
      </div>


      

      {/* Who am I Dialog */}
      <Dialog
        open={showIdentityDialog}
        onOpenChange={(open) => {
          setShowIdentityDialog(open)
          setIsMapVisible(!open) // Show map when dialog closes
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Patient Identification</DialogTitle>
            <DialogDescription>
              This information can help the patient identify themselves and contact their caretaker.
            </DialogDescription>
            <div className="flex flex-col items-center justify-center space-y-4 py-4">
              <Avatar className="h-24 w-24">
                <AvatarImage src={userData?.patient_photo_url || ""} alt="Patient" />
                <AvatarFallback>{userData?.patient_name?.charAt(0) || "P"}</AvatarFallback>
              </Avatar>
              <div className="text-center">
                <h3 className="font-medium text-lg">{userData?.patient_name}</h3>
                <p className="text-muted-foreground">Patient ID: #{userData?.id?.slice(0, 8)}</p>
              </div>
              {knownPeople.length > 0 && (
                <div className="w-full space-y-2">
                  <div className="flex justify-between">
                    <p className="text-sm font-medium">Caretaker:</p>
                    <p className="text-sm">{knownPeople[0].name}</p>
                  </div>
                  <div className="flex justify-between">
                    <p className="text-sm font-medium">Relationship:</p>
                    <p className="text-sm">{knownPeople[0].relationship}</p>
                  </div>
                </div>
              )}
            </div>
          </DialogHeader>
          <DialogFooter>
            <Button
              className="w-full"
              onClick={() => {
                setShowIdentityDialog(false)
                setIsMapVisible(true)
                handleEmergencyCall()
              }}
            >
              <Phone className="mr-2 h-4 w-4" />
              Call Caretaker
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Who is this Dialog */}
      <Dialog
        open={showRecognitionDialog}
        onOpenChange={(open) => {
          if (!open) stopCamera()
          setShowRecognitionDialog(open)
          setIsMapVisible(!open) // Show map when dialog closes
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Who is this person?</DialogTitle>
            <DialogDescription>Take a photo or upload an image of the person you want to identify</DialogDescription>
          </DialogHeader>

          {isUsingCamera ? (
            <div className="relative border rounded-lg overflow-hidden">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-64 object-cover"
                style={{ minHeight: "240px" }}
                onError={(e) => {
                  console.error("Video error:", e)
                  toast.error("Error displaying video stream")
                  stopCamera()
                }}
              />
              <div className="absolute bottom-2 left-0 right-0 flex justify-center space-x-2">
                <Button onClick={capturePhoto}>
                  <Camera className="mr-2 h-4 w-4" />
                  Capture
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    stopCamera()
                    setIsUsingCamera(false)
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col space-y-4">
              <div className="flex justify-center space-x-4">
                <Button
                  onClick={async () => {
                    console.log("Take Photo button clicked")
                    console.log("Video element exists:", !!videoRef.current)
                    const hasCamera = await checkCameraAvailability()
                    if (hasCamera) {
                      setIsUsingCamera(true)
                      // Small delay to ensure state update before starting camera
                      setTimeout(() => {
                        startCamera()
                      }, 100)
                    }
                  }}
                >
                  <Camera className="mr-2 h-4 w-4" />
                  Take Photo
                </Button>
                <div className="relative">
                  <Button variant="outline" onClick={() => document.getElementById("upload-photo")?.click()}>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload Photo
                  </Button>
                  <input
                    type="file"
                    id="upload-photo"
                    className="sr-only"
                    accept="image/*"
                    onChange={handleFileUpload}
                  />
                </div>
              </div>
            </div>
          )}

          {capturedImage && !recognitionResult && (
            <div className="flex flex-col space-y-4">
              <div className="border rounded-lg overflow-hidden">
                <img
                  src={capturedImage || "/placeholder.svg"}
                  alt="Preview"
                  className="w-full object-contain"
                  style={{ minHeight: "240px", maxHeight: "320px" }}
                />
              </div>
              <div className="flex justify-center space-x-2">
                <Button onClick={recognizePerson}>
                  <User className="mr-2 h-4 w-4" />
                  Identify Person
                </Button>
                <Button variant="outline" onClick={resetRecognition}>
                  Try Again
                </Button>
              </div>
            </div>
          )}

          {recognitionResult && (
            <div className="flex flex-col space-y-4">
              <div className="flex items-center justify-center">
                {recognitionResult.isRecognized ? (
                  <CheckCircle className="h-12 w-12 text-green-500 mb-2" />
                ) : (
                  <AlertTriangle className="h-12 w-12 text-amber-500 mb-2" />
                )}
              </div>
              <h3 className="text-xl font-semibold text-center">
                {recognitionResult.isRecognized ? "Person Identified!" : "Stranger Alert"}
              </h3>

              {recognitionError && (
                <Alert variant="destructive" className="mb-2">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{recognitionError}</AlertDescription>
                </Alert>
              )}

              <div className="flex items-center space-x-4 border rounded-lg p-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage
                    src={
                      recognitionResult.isRecognized
                        ? recognitionResult.person?.imageUrl
                        : capturedImage || "/placeholder.svg"
                    }
                    alt="Person"
                  />
                  <AvatarFallback>
                    {recognitionResult.isRecognized ? recognitionResult.person?.name.charAt(0) : "?"}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">
                    {recognitionResult.isRecognized ? recognitionResult.person?.name : "Unknown Person"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {recognitionResult.isRecognized ? recognitionResult.person?.relationship : "Not in your database"}
                  </p>
                  {recognitionResult.isRecognized && recognitionResult.person?.details && (
                    <p className="text-sm mt-1">{recognitionResult.person.details}</p>
                  )}
                </div>
              </div>

              {recognitionResult.isRecognized ? (
                <Button onClick={() => recognitionResult?.person && handleCallPerson(recognitionResult.person)}>
                  <Phone className="mr-2 h-4 w-4" />
                  Call This Person
                </Button>
              ) : (
                <>
                  <Alert variant="warning">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Warning</AlertTitle>
                    <AlertDescription>This person is not in your database. They may be a stranger.</AlertDescription>
                  </Alert>
  
                </>
              )}

              <Button variant="outline" onClick={resetRecognition}>
                Try Again
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Person Dialog */}
      <Dialog
        open={showAddPersonDialog}
        onOpenChange={(open) => {
          setShowAddPersonDialog(open)
          setIsMapVisible(!open) // Show map when dialog closes
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Person</DialogTitle>
            <DialogDescription>Add this person to your known people database</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col space-y-4 py-4">
            <div className="flex justify-center">
              <Avatar className="h-24 w-24">
                <AvatarImage src={capturedImage || "/placeholder.svg"} alt="New person" />
                <AvatarFallback>NP</AvatarFallback>
              </Avatar>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <FormLabel>Name</FormLabel>
                <Input
                  placeholder="Enter name"
                  value={newPerson.name}
                  onChange={(e) => setNewPerson({ ...newPerson, name: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <FormLabel>Relationship</FormLabel>
                <Input
                  placeholder="Enter relationship"
                  value={newPerson.relationship}
                  onChange={(e) => setNewPerson({ ...newPerson, relationship: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <FormLabel>Additional Details</FormLabel>
                <Textarea
                  placeholder="Enter additional details"
                  value={newPerson.details}
                  onChange={(e) => setNewPerson({ ...newPerson, details: e.target.value })}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddPersonDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddPerson}>Save Person</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

