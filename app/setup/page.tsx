"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Progress } from "@/components/ui/progress"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Upload, MapPin, User, Trash2, X, Loader2, Search } from "lucide-react"
import { supabase } from "../supabaseConfig"
import { v4 } from "uuid"
import { toast } from "sonner"
import L from "leaflet"
import "leaflet/dist/leaflet.css"

interface KnownPerson {
  id: number
  name: string
  relationship: string
  details: string | null
  address: string
  photo_url: string
  supabase_img_url: string | null
  phone: number
  user_id: string
  is_emergency_contact: boolean
}

// Update the UserData interface to include base_address
interface UserData {
  id: string
  email: string
  patient_name: string
  patient_photo_url: string | null
  base_latitude?: number
  base_longitude?: number
  radius?: number
  base_location?: string
}

interface LocationCoordinates {
  lat: number
  lng: number
}

export default function SetupPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [progress, setProgress] = useState(20)
  const [knownPeople, setKnownPeople] = useState<KnownPerson[]>([])
  const [showKnownPeopleModal, setShowKnownPeopleModal] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [currentUser, setCurrentUser] = useState<UserData | null>(null)

  // Form states
  const [personName, setPersonName] = useState("")
  const [personRelationship, setPersonRelationship] = useState("")
  const [personDetails, setPersonDetails] = useState("")
  const [personPhotoURL, setPersonPhotoURL] = useState("")
  const [patientName, setPatientName] = useState("")
  const [patientRelationship, setPatientRelationship] = useState("")
  const [baseLocation, setBaseLocation] = useState("")
  const [baseLocationCoords, setBaseLocationCoords] = useState<LocationCoordinates | null>(null)
  const [safeRadius, setSafeRadius] = useState(500)
  const [emergencyContactName, setEmergencyContactName] = useState("")
  const [emergencyContactPhone, setEmergencyContactPhone] = useState("")
  const [emergencyContactRelationship, setEmergencyContactRelationship] = useState("")
  const [secondaryContactPhone, setSecondaryContactPhone] = useState("")
  const [patientPhotos, setPatientPhotos] = useState<{ front?: string }>({})
  const fileInputRef = useRef<HTMLInputElement>(null)
  const frontPhotoRef = useRef<HTMLInputElement>(null)
  const [personAddress, setPersonAddress] = useState("")
  const [personPhone, setPersonPhone] = useState("")
  const [isEmergencyContact, setIsEmergencyContact] = useState(false)
  const [isAddressSearching, setIsAddressSearching] = useState(false)
  const [addressSearchError, setAddressSearchError] = useState<string | null>(null)

  // Map refs
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)
  const circleRef = useRef<L.Circle | null>(null)

  // Load current user and their data on component mount
  useEffect(() => {
    loadCurrentUser()
  }, [])

  // Initialize map when step is 2
  useEffect(() => {
    if (step === 2 && mapRef.current && !mapInstanceRef.current) {
      initializeMap()
    }
  }, [step])

  // Update circle radius when safe radius changes
  useEffect(() => {
    if (circleRef.current) {
      circleRef.current.setRadius(safeRadius)
    }
  }, [safeRadius])

  const initializeMap = async () => {
    if (!mapRef.current) return

    // Get user's current location
    let initialLat = 40.7128
    let initialLng = -74.006
    const initialZoom = 13

    try {
      // Try to get user's current position
      const position = await getCurrentPosition()
      initialLat = position.coords.latitude
      initialLng = position.coords.longitude

      // If we have stored coordinates, use those instead
      if (currentUser?.base_latitude && currentUser?.base_longitude) {
        initialLat = currentUser.base_latitude
        initialLng = currentUser.base_longitude

        // Also set the base location coordinates state
        setBaseLocationCoords({
          lat: initialLat,
          lng: initialLng,
        })

        // Get address from coordinates for display
        getAddressFromCoordinates(initialLat, initialLng)
      }

      // If we have a stored safe radius, use that
      if (currentUser?.radius) {
        setSafeRadius(currentUser.radius)
      }
    } catch (error) {
      console.error("Error getting current position:", error)
      toast.error("Could not get your current location. Using default location.")
    }

    // Fix Leaflet icon paths issue
    delete (L.Icon.Default.prototype as any)._getIconUrl
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png",
      iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
      shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
    })

    // Create custom marker icon
    const homeIcon = L.divIcon({
      html: `
        <div class="relative">
          <div class="absolute -top-4 -left-4 w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
              <polyline points="9 22 9 12 15 12 15 22"></polyline>
            </svg>
          </div>
        </div>
      `,
      className: "",
      iconSize: [0, 0],
      iconAnchor: [0, 0],
    })

    // Create map instance
    const map = L.map(mapRef.current).setView([initialLat, initialLng], initialZoom)

    // Add tile layer (OpenStreetMap)
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map)

    // Add marker for base location
    const marker = L.marker([initialLat, initialLng], {
      icon: homeIcon,
      draggable: true,
    })
      .addTo(map)
      .bindPopup("Base Location")
      .openPopup()

    // Add circle for safe radius
    const circle = L.circle([initialLat, initialLng], {
      radius: safeRadius,
      color: "rgba(34, 197, 94, 0.5)",
      fillColor: "rgba(34, 197, 94, 0.1)",
      fillOpacity: 0.3,
    }).addTo(map)

    // Handle marker drag events
    marker.on("dragend", (e) => {
      const position = marker.getLatLng()
      circle.setLatLng(position)

      // Update state with new coordinates
      setBaseLocationCoords({
        lat: position.lat,
        lng: position.lng,
      })

      // Get address from coordinates
      getAddressFromCoordinates(position.lat, position.lng)
    })

    // Store refs
    mapInstanceRef.current = map
    markerRef.current = marker
    circleRef.current = circle
  }

  const getCurrentPosition = (): Promise<GeolocationPosition> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation is not supported by your browser"))
        return
      }

      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0,
      })
    })
  }

  // Update the setCurrentLocationAsBase function to also update the base_address
  const setCurrentLocationAsBase = async () => {
    try {
      const position = await getCurrentPosition()
      const { latitude, longitude } = position.coords

      // Update marker and circle positions
      if (markerRef.current && circleRef.current) {
        markerRef.current.setLatLng([latitude, longitude])
        circleRef.current.setLatLng([latitude, longitude])

        // Center map on new location
        if (mapInstanceRef.current) {
          mapInstanceRef.current.setView([latitude, longitude], mapInstanceRef.current.getZoom())
        }
      }

      // Update state
      setBaseLocationCoords({
        lat: latitude,
        lng: longitude,
      })

      // Get address from coordinates and update base_address
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
        )
        const data = await response.json()

        if (data && data.display_name) {
          setBaseLocation(data.display_name)

          // If the user has already set up their account, update the base_address immediately
          if (currentUser) {
            const { error } = await supabase
              .from("users")
              .update({
                base_location: data.display_name,
                base_latitude: latitude,
                base_longitude: longitude,
              })
              .eq("id", currentUser.id)

            if (error) {
              console.error("Error updating base address:", error)
            }
          }
        } else {
          setBaseLocation(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`)
        }
      } catch (error) {
        console.error("Error getting address from coordinates:", error)
        setBaseLocation(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`)
      }

      toast.success("Current location set as base")
    } catch (error) {
      console.error("Error getting current position:", error)
      toast.error("Could not get your current location")
    }
  }

  const getAddressFromCoordinates = async (lat: number, lng: number) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      )
      const data = await response.json()

      if (data && data.display_name) {
        setBaseLocation(data.display_name)
      } else {
        setBaseLocation(`${lat.toFixed(6)}, ${lng.toFixed(6)}`)
      }
    } catch (error) {
      console.error("Error getting address from coordinates:", error)
      setBaseLocation(`${lat.toFixed(6)}, ${lng.toFixed(6)}`)
    }
  }

  // Update the getCoordinatesFromAddress function to ensure the address is stored
  const getCoordinatesFromAddress = async (address: string) => {
    setIsAddressSearching(true)
    setAddressSearchError(null)

    try {
      const encodedAddress = encodeURIComponent(address)
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&limit=1`)
      const data = await response.json()

      if (data && data.length > 0) {
        const { lat, lon } = data[0]
        const latitude = Number.parseFloat(lat)
        const longitude = Number.parseFloat(lon)

        // Update marker and circle positions
        if (markerRef.current && circleRef.current) {
          markerRef.current.setLatLng([latitude, longitude])
          circleRef.current.setLatLng([latitude, longitude])

          // Center map on new location
          if (mapInstanceRef.current) {
            mapInstanceRef.current.setView([latitude, longitude], 15)
          }
        }

        // Update state
        setBaseLocationCoords({
          lat: latitude,
          lng: longitude,
        })

        // Store the address directly from user input
        setBaseLocation(address)

        // If the user has already set up their account, update the base_address immediately
        if (currentUser) {
          const { error } = await supabase
            .from("users")
            .update({
              base_location: address,
              base_latitude: latitude,
              base_longitude: longitude,
            })
            .eq("id", currentUser.id)

          if (error) {
            console.error("Error updating base address:", error)
          }
        }

        toast.success("Address located successfully")
      } else {
        setAddressSearchError("Address not found. Please try a different address.")
        toast.error("Address not found")
      }
    } catch (error) {
      console.error("Error getting coordinates from address:", error)
      setAddressSearchError("Error searching for address. Please try again.")
      toast.error("Error searching for address")
    } finally {
      setIsAddressSearching(false)
    }
  }

  const loadCurrentUser = async () => {
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
        setCurrentUser(userData)
        setPatientName(userData.patient_name || "")
        setPatientPhotos({
          front: userData.patient_photo_url || undefined,
        })

        // Set location data if available
        if (userData.base_latitude && userData.base_longitude) {
          setBaseLocationCoords({
            lat: userData.base_latitude,
            lng: userData.base_longitude,
          })
        }

        if (userData.radius) {
          setSafeRadius(userData.radius)
        }

        loadKnownPeople(user.id)
      }
    } catch (error) {
      console.error("Error loading user:", error)
      toast.error("Failed to load user data")
    }
  }

  const loadKnownPeople = async (userId: string) => {
    setIsLoading(true)
    try {
      const { data, error } = await supabase.from("Known_People").select("*").eq("user_id", userId)

      if (error) {
        console.error("Supabase error:", error)
        toast.error(`Failed to load known people: ${error.message}`)
        return
      }

      if (data) {
        setKnownPeople(data)
      }
    } catch (error) {
      console.error("Error loading known people:", error)
      toast.error("Failed to load known people. Please check your connection.")
    } finally {
      setIsLoading(false)
    }
  }

  // Update the nextStep function to include base_address in the user data update
  const nextStep = async () => {
    if (step < 4) {
      // Validate current step
      if (step === 1 && !patientName) {
        toast.error("Please enter the patient's name")
        return
      }

      if (step === 2 && !baseLocationCoords) {
        toast.error("Please set a base location")
        return
      }

      setStep(step + 1)
      setProgress((step + 1) * 25)
    } else {
      if (!currentUser) return
      if (!baseLocationCoords) {
        toast.error("Base location coordinates are missing")
        return
      }

      setIsLoading(true)
      try {
        // Update user's patient name and location data
        const { error: userError } = await supabase
          .from("users")
          .update({
            patient_name: patientName,
            base_latitude: baseLocationCoords.lat,
            base_longitude: baseLocationCoords.lng,
            radius: safeRadius,
            base_location: baseLocation, // Store the base location address
          })
          .eq("id", currentUser.id)

        if (userError) throw userError

        // Delete all existing records for this user
        const { error: deleteError } = await supabase.from("Known_People").delete().eq("user_id", currentUser.id)

        if (deleteError) {
          console.error("Error deleting existing records:", deleteError)
          throw deleteError
        }

        // Insert all new records
        const { error: insertError } = await supabase.from("Known_People").insert(
          knownPeople.map((person) => ({
            ...person,
            details: person.details || null,
            supabase_img_url: person.supabase_img_url || null,
          })),
        )

        if (insertError) {
          console.error("Error inserting new records:", insertError)
          throw insertError
        }

        toast.success("Setup completed successfully!")
        router.push("/dashboard")
      } catch (error: any) {
        console.error("Error saving data:", error.message || error)
        toast.error(`Failed to save data: ${error.message || "Unknown error"}`)
      } finally {
        setIsLoading(false)
      }
    }
  }

  const prevStep = () => {
    if (step > 1) {
      setStep(step - 1)
      setProgress((step - 1) * 20)
    }
  }

  const handleUploadToSupabase = async (file: File): Promise<string> => {
    if (!file) return ""

    setUploading(true)
    try {
      const fileExt = file.name.split(".").pop()
      const fileName = `${v4()}.${fileExt}`
      const filePath = `patient-images/${fileName}`

      const { error: uploadError, data } = await supabase.storage.from("patient-images").upload(filePath, file)

      if (uploadError) throw uploadError

      const {
        data: { publicUrl },
      } = supabase.storage.from("patient-images").getPublicUrl(filePath)

      toast.success("Image uploaded successfully")
      return publicUrl
    } catch (error) {
      console.error("Error uploading image:", error)
      toast.error("Failed to upload image")
      return ""
    } finally {
      setUploading(false)
    }
  }

  const handleAddPerson = async () => {
    if (!personName || !personRelationship || !personAddress || !personPhone || !currentUser) {
      toast.error("Please fill in all required fields")
      return
    }

    setIsLoading(true)
    let supabaseImageUrl = ""

    try {
      if (personPhotoURL && personPhotoURL.startsWith("data:")) {
        const response = await fetch(personPhotoURL)
        const blob = await response.blob()
        const file = new File([blob], "photo.jpg", { type: "image/jpeg" })
        supabaseImageUrl = await handleUploadToSupabase(file)
      }

      const newPerson: KnownPerson = {
        id: Date.now(),
        name: personName,
        relationship: personRelationship,
        details: personDetails || null,
        address: personAddress,
        photo_url: personPhotoURL || `/placeholder.svg?height=150&width=150&text=${personName.charAt(0)}`,
        supabase_img_url: supabaseImageUrl || null,
        phone: Number.parseInt(personPhone) || 0,
        user_id: currentUser.id,
        is_emergency_contact: isEmergencyContact,
      }

      // Insert directly into Supabase
      const { error: insertError } = await supabase.from("Known_People").insert([newPerson])

      if (insertError) {
        console.error("Error inserting person:", insertError)
        throw insertError
      }

      setKnownPeople([...knownPeople, newPerson])
      toast.success("Person added successfully")

      // Clear form
      setPersonName("")
      setPersonRelationship("")
      setPersonDetails("")
      setPersonPhotoURL("")
      setPersonAddress("")
      setPersonPhone("")
      setIsEmergencyContact(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    } catch (error) {
      console.error("Error adding person:", error)
      toast.error("Failed to add person")
    } finally {
      setIsLoading(false)
    }
  }

  const handleRemovePerson = async (id: number) => {
    if (!currentUser) return

    setIsLoading(true)
    try {
      // First, get the person's photo URL if it exists
      const person = knownPeople.find((p) => p.id === id)
      if (person?.supabase_img_url) {
        // Extract the file path from the URL
        const filePath = person.supabase_img_url.split("/").pop()
        if (filePath) {
          // Delete the image from storage
          const { error: storageError } = await supabase.storage.from("patient-images").remove([filePath])

          if (storageError) {
            console.error("Error deleting image from storage:", storageError)
          }
        }
      }

      // Delete the person from the database
      const { error } = await supabase.from("Known_People").delete().eq("id", id).eq("user_id", currentUser.id)

      if (error) throw error

      // Update local state
      setKnownPeople(knownPeople.filter((person) => person.id !== id))
      toast.success("Person removed successfully")
    } catch (error) {
      console.error("Error removing person:", error)
      toast.error("Failed to remove person")
    } finally {
      setIsLoading(false)
    }
  }

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      const reader = new FileReader()

      reader.onload = (event) => {
        if (event.target?.result) {
          setPersonPhotoURL(event.target.result as string)
        }
      }

      reader.readAsDataURL(file)
    }
  }

  const handlePatientPhotoChange = async (e: React.ChangeEvent<HTMLInputElement>, type: "front") => {
    if (!currentUser) return

    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      const downloadURL = await handleUploadToSupabase(file)

      setPatientPhotos((prev) => ({
        ...prev,
        [type]: downloadURL,
      }))

      // Update user's photo in the database
      const updateField = "patient_photo_url"
      const { error } = await supabase
        .from("users")
        .update({ [updateField]: downloadURL })
        .eq("id", currentUser.id)

      if (error) {
        console.error("Error updating patient photo:", error)
        toast.error("Failed to update patient photo")
      }
    }
  }

  const clearPhotoPreview = () => {
    setPersonPhotoURL("")
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleDeletePatientPhoto = async (type: "front") => {
    if (!currentUser) return

    try {
      // Update the state to remove the photo
      setPatientPhotos((prev) => ({
        ...prev,
        [type]: undefined,
      }))

      // Update the database to remove the photo URL
      const updateField = "patient_photo_url"
      const { error } = await supabase
        .from("users")
        .update({ [updateField]: null })
        .eq("id", currentUser.id)

      if (error) {
        console.error("Error deleting patient photo:", error)
        toast.error("Failed to delete patient photo")
      } else {
        toast.success("Photo deleted successfully")
      }
    } catch (error) {
      console.error("Error deleting patient photo:", error)
      toast.error("Failed to delete patient photo")
    }
  }

  const handleAddressSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (baseLocation.trim()) {
      getCoordinatesFromAddress(baseLocation.trim())
    } else {
      toast.error("Please enter an address to search")
    }
  }

  const handleSafeRadiusChange = (value: number[]) => {
    const radius = value[0]
    setSafeRadius(radius)
  }

  return (
    <div className="container flex items-center justify-center min-h-screen py-12">
      <Card className="w-full max-w-2xl">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Patient Setup</CardTitle>
          <CardDescription>Complete the following steps to set up monitoring for your patient</CardDescription>
          <Progress value={progress} className="h-2 mt-2" />
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Upload Patient Photos</h3>
              <p className="text-muted-foreground">Upload clear photos of the patient to help with identification</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div
                  className="border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center h-40 cursor-pointer hover:border-primary"
                  onClick={() => frontPhotoRef.current?.click()}
                >
                  {patientPhotos.front ? (
                    <img
                      src={patientPhotos.front || "/placeholder.svg"}
                      alt="Front-facing preview"
                      className="h-full w-full object-cover rounded"
                    />
                  ) : (
                    <>
                      <Upload className="h-10 w-10 text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">Upload front-facing photo</p>
                    </>
                  )}
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    ref={frontPhotoRef}
                    onChange={(e) => handlePatientPhotoChange(e, "front")}
                  />
                </div>
              </div>
              <div className="space-y-2 mt-4">
                <Label htmlFor="patient-name">Patient Name</Label>
                <Input
                  id="patient-name"
                  placeholder="Enter patient's full name"
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="relationship">Your Relationship to Patient</Label>
                <Select value={patientRelationship} onValueChange={setPatientRelationship}>
                  <SelectTrigger id="relationship">
                    <SelectValue placeholder="Select relationship" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="family">Family Member</SelectItem>
                    <SelectItem value="professional">Professional Caretaker</SelectItem>
                    <SelectItem value="friend">Friend</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Set Location Parameters</h3>
              <p className="text-muted-foreground">Define the base location and safe radius for the patient</p>

              <div className="border rounded-lg overflow-hidden h-64">
                <div ref={mapRef} className="w-full h-full"></div>
              </div>

              <div className="flex justify-center">
                <Button variant="outline" size="sm" onClick={setCurrentLocationAsBase} className="flex items-center">
                  <MapPin className="mr-2 h-4 w-4" />
                  Set Current Location as Base
                </Button>
              </div>

              <form onSubmit={handleAddressSearch} className="space-y-2">
                <Label htmlFor="address">Base Location Address</Label>
                <div className="flex space-x-2">
                  <div className="relative flex-grow">
                    <Input
                      id="address"
                      placeholder="Enter full address"
                      value={baseLocation}
                      onChange={(e) => setBaseLocation(e.target.value)}
                      className="pr-10"
                    />
                    {isAddressSearching && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <Button type="submit" disabled={isAddressSearching}>
                    <Search className="h-4 w-4 mr-2" />
                    Search
                  </Button>
                </div>
                {addressSearchError && <p className="text-sm text-destructive mt-1">{addressSearchError}</p>}
              </form>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label htmlFor="radius">Safe Radius (meters)</Label>
                  <span className="text-sm text-muted-foreground">{safeRadius}m</span>
                </div>
                <Slider
                  id="radius"
                  value={[safeRadius]}
                  min={100}
                  max={100000}
                  step={100}
                  onValueChange={handleSafeRadiusChange}
                />
                <p className="text-xs text-muted-foreground">
                  The patient will be considered safe when within this radius of the base location.
                </p>
              </div>

              {baseLocationCoords && (
                <div className="p-3 bg-muted rounded-md">
                  <p className="text-sm font-medium">Selected Location:</p>
                  <p className="text-sm text-muted-foreground break-words">{baseLocation}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Coordinates: {baseLocationCoords.lat.toFixed(6)}, {baseLocationCoords.lng.toFixed(6)}
                  </p>
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Add Known People</h3>
              <p className="text-muted-foreground">Add people the patient knows for the recognition feature</p>

              <div className="border rounded-lg p-4 max-h-[200px] overflow-y-auto">
                {knownPeople.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <User className="h-10 w-10 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">
                      No people added yet. Use the form below to add people the patient knows.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {knownPeople.map((person) => (
                      <div key={person.id} className="flex items-center p-2 border rounded-lg">
                        <div className="h-12 w-12 rounded-full overflow-hidden mr-3 flex-shrink-0">
                          {person.photo_url.startsWith("data:") ? (
                            <img
                              src={person.photo_url || "/placeholder.svg"}
                              alt={person.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="h-full w-full bg-muted flex items-center justify-center text-lg font-semibold">
                              {person.name.charAt(0)}
                            </div>
                          )}
                        </div>
                        <div className="flex-grow">
                          <p className="font-medium">{person.name}</p>
                          <p className="text-sm text-muted-foreground">{person.relationship}</p>
                          {person.is_emergency_contact && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                              Emergency Contact
                            </span>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemovePerson(person.id)}
                          className="text-destructive hover:text-destructive/90 hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="border rounded-lg p-4 mt-4">
                <h4 className="font-medium mb-3">Add Person</h4>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="person-name">Name</Label>
                    <Input
                      id="person-name"
                      placeholder="Enter person's name"
                      value={personName}
                      onChange={(e) => setPersonName(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="person-relationship">Relationship to Patient</Label>
                    <Input
                      id="person-relationship"
                      placeholder="E.g., Daughter, Doctor, Neighbor"
                      value={personRelationship}
                      onChange={(e) => setPersonRelationship(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="person-address">Address</Label>
                    <Input
                      id="person-address"
                      placeholder="Enter person's address"
                      value={personAddress}
                      onChange={(e) => setPersonAddress(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="person-phone">Phone Number</Label>
                    <Input
                      id="person-phone"
                      type="tel"
                      placeholder="Enter phone number"
                      value={personPhone}
                      onChange={(e) => setPersonPhone(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="person-details">Additional Details</Label>
                    <Textarea
                      id="person-details"
                      placeholder="E.g., Visits on weekends, Lives nearby, etc."
                      value={personDetails}
                      onChange={(e) => setPersonDetails(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Photo</Label>
                    {personPhotoURL ? (
                      <div className="relative w-24 h-24 mt-2">
                        <img
                          src={personPhotoURL || "/placeholder.svg"}
                          alt="Preview"
                          className="w-full h-full object-cover rounded-md"
                        />
                        <Button
                          variant="destructive"
                          size="icon"
                          className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                          onClick={(e) => {
                            e.stopPropagation()
                            clearPhotoPreview()
                          }}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <div
                        className="border-2 border-dashed rounded-lg p-4 flex flex-col items-center justify-center h-24 cursor-pointer hover:border-primary"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Upload className="h-6 w-6 text-muted-foreground mb-1" />
                        <p className="text-xs text-muted-foreground">Upload photo</p>
                        <input
                          type="file"
                          ref={fileInputRef}
                          className="hidden"
                          accept="image/*"
                          onChange={handlePhotoChange}
                        />
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center space-x-2 cursor-pointer">
                      <Input
                        type="checkbox"
                        className="w-4 h-4"
                        checked={isEmergencyContact}
                        onChange={(e) => setIsEmergencyContact(e.target.checked)}
                      />
                      <span>Designate as Emergency Contact</span>
                    </Label>
                  </div>

                  <Button onClick={handleAddPerson} className="w-full">
                    Add Person
                  </Button>
                </div>
              </div>
            </div>
          )}
          {step === 4 && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Review and Confirm</h3>
              <p className="text-muted-foreground">Please review the information below before finalizing setup</p>
              <div className="space-y-4 border rounded-lg p-4">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-sm font-medium">Patient Name:</p>
                    <p className="text-sm text-muted-foreground">{patientName}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Relationship:</p>
                    <p className="text-sm text-muted-foreground">{patientRelationship}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Base Location:</p>
                    <p className="text-sm text-muted-foreground line-clamp-2">{baseLocation}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Safe Radius:</p>
                    <p className="text-sm text-muted-foreground">{safeRadius} meters</p>
                  </div>
                </div>

                <div className="pt-3 border-t mt-3">
                  <h4 className="text-sm font-medium mb-2">Emergency Contacts</h4>
                  <div className="space-y-2">
                    {knownPeople
                      .filter((person) => person.is_emergency_contact)
                      .map((person) => (
                        <div key={person.id} className="flex items-center space-x-3">
                          <div className="h-8 w-8 rounded-full overflow-hidden">
                            {person.photo_url.startsWith("data:") ? (
                              <img
                                src={person.photo_url || "/placeholder.svg"}
                                alt={person.name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="h-full w-full bg-muted flex items-center justify-center text-sm font-semibold">
                                {person.name.charAt(0)}
                              </div>
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-medium">{person.name}</p>
                            <p className="text-sm text-muted-foreground">{person.phone}</p>
                            <p className="text-sm text-muted-foreground">Relationship: {person.relationship}</p>
                          </div>
                        </div>
                      ))}
                    {knownPeople.filter((person) => person.is_emergency_contact).length === 0 && (
                      <p className="text-sm text-muted-foreground">No emergency contacts designated</p>
                    )}
                  </div>
                </div>

                <div className="flex justify-center space-x-2">
                  {patientPhotos.front && (
                    <div className="relative w-20 h-20">
                      <img
                        src={patientPhotos.front || "/placeholder.svg"}
                        alt="Front-facing photo"
                        className="w-full h-full object-cover rounded-lg"
                      />
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t mt-3">
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="text-sm font-medium">Known People</h4>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowKnownPeopleModal(true)}
                      disabled={knownPeople.length === 0}
                    >
                      View List
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {knownPeople.length} people added ({knownPeople.filter((p) => p.is_emergency_contact).length}{" "}
                    emergency contacts)
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm" className="flex items-center space-x-2 cursor-pointer">
                  <Input id="confirm" type="checkbox" className="w-4 h-4" />
                  <span>I confirm that all information provided is accurate</span>
                </Label>
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button variant="outline" onClick={prevStep} disabled={step === 1 || isLoading}>
            Back
          </Button>
          <Button onClick={nextStep} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {step < 4 ? "Saving..." : "Completing Setup..."}
              </>
            ) : step < 4 ? (
              "Continue"
            ) : (
              "Complete Setup"
            )}
          </Button>
        </CardFooter>
      </Card>

      {/* Known People Modal */}
      <Dialog open={showKnownPeopleModal} onOpenChange={setShowKnownPeopleModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Known People List</DialogTitle>
            <DialogDescription>People the patient knows for the recognition feature</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto p-1">
            {knownPeople.map((person) => (
              <div key={person.id} className="border rounded-lg overflow-hidden">
                <div className="h-32 bg-muted">
                  {person.photo_url.startsWith("data:") ? (
                    <img
                      src={person.photo_url || "/placeholder.svg"}
                      alt={person.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-4xl font-semibold">
                      {person.name.charAt(0)}
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <p className="font-medium">{person.name}</p>
                  <p className="text-sm text-muted-foreground">{person.relationship}</p>
                  {person.details && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{person.details}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button onClick={() => setShowKnownPeopleModal(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

