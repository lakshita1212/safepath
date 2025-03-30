"use client"

import { useState, useEffect, useRef } from "react"
import { MapPin, Home, Clock, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import { supabase } from "../supabaseConfig"

// Default initial location (Princeton, NJ)
const DEFAULT_LOCATION = {
  lat: 40.68937946092346,
  lng: -74.04452188314681,
}

// Calculate distance between two points in meters
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371e3 // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lon2 - lon1) * Math.PI) / 180

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c
}

interface MapComponentProps {
  onLocationUpdate?: (location: { lat: number; lng: number; distance: number }) => void
  safeRadius?: number
}

export default function MapComponent({ onLocationUpdate, safeRadius: propSafeRadius }: MapComponentProps) {
  // State for user data from database
  const [userData, setUserData] = useState<{
    base_latitude: number
    base_longitude: number
    radius: number
  } | null>(null)

  // Base location from user data or default
  const [baseLocation, setBaseLocation] = useState({
    lat: DEFAULT_LOCATION.lat,
    lng: DEFAULT_LOCATION.lng,
  })

  // Safe radius from user data or props or default
  const [safeRadius, setSafeRadius] = useState(500)

  const [patientLocation, setPatientLocation] = useState(DEFAULT_LOCATION)
  const [currentDistance, setCurrentDistance] = useState(0)
  const [lastUpdated, setLastUpdated] = useState(new Date())
  const [showBaseLocation, setShowBaseLocation] = useState(true)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [isSimulationMode, setIsSimulationMode] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const patientMarkerRef = useRef<L.Marker | null>(null)
  const baseMarkerRef = useRef<L.Marker | null>(null)
  const safeZoneCircleRef = useRef<L.Circle | null>(null)
  const simulationIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Fetch user data from Supabase
  useEffect(() => {
    async function fetchUserData() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          console.error("No authenticated user found")
          return
        }

        const { data, error } = await supabase
          .from("users")
          .select("base_latitude, base_longitude, radius")
          .eq("id", user.id)
          .single()

        if (error) {
          console.error("Error fetching user data:", error)
          return
        }

        if (data) {
          setUserData(data)

          // Set base location from database
          if (data.base_latitude && data.base_longitude) {
            setBaseLocation({
              lat: data.base_latitude,
              lng: data.base_longitude,
            })
          }

          // Set safe radius from database or props
          setSafeRadius(data.radius || propSafeRadius || 500)
        }
      } catch (error) {
        console.error("Error in fetchUserData:", error)
      }
    }

    fetchUserData()
  }, [propSafeRadius])

  // Custom icons for markers
  const createPatientIcon = () => {
    return L.divIcon({
      html: `
        <div class="relative">
          <div class="absolute -top-4 -left-4 w-8 h-8 bg-red-500 rounded-full flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path>
              <circle cx="12" cy="10" r="3"></circle>
            </svg>
          </div>
        </div>
      `,
      className: "",
      iconSize: [0, 0],
      iconAnchor: [0, 0],
    })
  }

  const createHomeIcon = () => {
    return L.divIcon({
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
  }

  // Try to get user's location or fall back to simulation
  useEffect(() => {
    // Don't try to get location until we have base location from database
    if (!baseLocation) return

    // Check if geolocation is available
    setIsLoading(true)
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by your browser")
      startSimulationMode()
      setIsLoading(false)
      return
    }

    try {
      // Try to get initial position
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords
          const newLocation = {
            lat: latitude,
            lng: longitude,
          }

          setPatientLocation(newLocation)
          setLastUpdated(new Date())
          setLocationError(null)
          setIsLoading(false)

          // Calculate distance from base
          const distance = calculateDistance(latitude, longitude, baseLocation.lat, baseLocation.lng)
          setCurrentDistance(Math.round(distance))

          // Notify parent component
          if (onLocationUpdate) {
            onLocationUpdate({
              lat: latitude,
              lng: longitude,
              distance,
            })
          }
        },
        (error) => {
          console.error("Error getting location:", error)
          setLocationError(`Geolocation access denied. Using simulation mode instead.`)
          startSimulationMode()
          setIsLoading(false)
        },
      )
    } catch (error) {
      console.error("Error accessing geolocation:", error)
      setLocationError("Error accessing geolocation. Using simulation mode instead.")
      startSimulationMode()
      setIsLoading(false)
    }

    return () => {
      stopSimulationMode()
    }
  }, [baseLocation])

  // Start simulation mode for location updates
  const startSimulationMode = () => {
    setIsSimulationMode(true)

    // Calculate initial distance
    const distance = calculateDistance(patientLocation.lat, patientLocation.lng, baseLocation.lat, baseLocation.lng)
    setCurrentDistance(Math.round(distance))

    // Notify parent component of initial location
    if (onLocationUpdate) {
      onLocationUpdate({
        lat: patientLocation.lat,
        lng: patientLocation.lng,
        distance,
      })
    }

    // Start simulation interval
    simulationIntervalRef.current = setInterval(() => {
      // Simulate patient movement
      const newLat = patientLocation.lat + (Math.random() - 0.5) * 0.001
      const newLng = patientLocation.lng + (Math.random() - 0.5) * 0.001
      const newLocation = {
        lat: newLat,
        lng: newLng,
      }

      setPatientLocation(newLocation)
      setLastUpdated(new Date())

      // Calculate distance from base
      const distance = calculateDistance(newLat, newLng, baseLocation.lat, baseLocation.lng)
      setCurrentDistance(Math.round(distance))

      // Update marker position
      if (patientMarkerRef.current) {
        patientMarkerRef.current.setLatLng([newLat, newLng])
      }

      // Notify parent component
      if (onLocationUpdate) {
        onLocationUpdate({
          lat: newLat,
          lng: newLng,
          distance,
        })
      }
    }, 5000)
  }

  // Stop simulation mode
  const stopSimulationMode = () => {
    if (simulationIntervalRef.current) {
      clearInterval(simulationIntervalRef.current)
      simulationIntervalRef.current = null
    }
  }

  // Initialize Leaflet map
  useEffect(() => {
    // Don't initialize the map until we have a non-default location
    // (either real location or simulation has started)
    if (
      typeof window !== "undefined" &&
      mapRef.current &&
      !mapInstanceRef.current &&
      (patientLocation.lat !== DEFAULT_LOCATION.lat || patientLocation.lng !== DEFAULT_LOCATION.lng || isSimulationMode)
    ) {
      // Fix Leaflet icon paths issue
      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
      })

      // Create map instance
      const map = L.map(mapRef.current).setView([patientLocation.lat, patientLocation.lng], 15)

      // Add tile layer (OpenStreetMap)
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map)

      // Add patient marker
      const patientIcon = createPatientIcon()
      const patientMarker = L.marker([patientLocation.lat, patientLocation.lng], { icon: patientIcon })
        .addTo(map)
        .bindPopup(isSimulationMode ? "Simulated Location" : "Your Location")

      // Create bounds with patient location
      const bounds = L.latLngBounds([[patientLocation.lat, patientLocation.lng]])

      // Add base location marker if enabled
      if (showBaseLocation) {
        const homeIcon = createHomeIcon()
        const baseMarker = L.marker([baseLocation.lat, baseLocation.lng], { icon: homeIcon })
          .addTo(map)
          .bindPopup("Base Location")

        // Add safe zone circle
        const safeZoneCircle = L.circle([baseLocation.lat, baseLocation.lng], {
          radius: safeRadius,
          color: "rgba(34, 197, 94, 0.5)",
          fillColor: "rgba(34, 197, 94, 0.1)",
          fillOpacity: 0.3,
        }).addTo(map)

        baseMarkerRef.current = baseMarker
        safeZoneCircleRef.current = safeZoneCircle

        bounds.extend([baseLocation.lat, baseLocation.lng])
        map.fitBounds(bounds, { padding: [50, 50] })
      }

      patientMarkerRef.current = patientMarker
      mapInstanceRef.current = map
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
        patientMarkerRef.current = null
        baseMarkerRef.current = null
        safeZoneCircleRef.current = null
      }
    }
  }, [patientLocation, isSimulationMode, showBaseLocation, safeRadius, baseLocation])

  // Update map when showBaseLocation changes
  useEffect(() => {
    if (mapInstanceRef.current) {
      if (showBaseLocation) {
        if (!baseMarkerRef.current) {
          const homeIcon = createHomeIcon()
          const baseMarker = L.marker([baseLocation.lat, baseLocation.lng], { icon: homeIcon })
            .addTo(mapInstanceRef.current)
            .bindPopup("Base Location")
          baseMarkerRef.current = baseMarker
        }

        if (!safeZoneCircleRef.current) {
          const safeZoneCircle = L.circle([baseLocation.lat, baseLocation.lng], {
            radius: safeRadius,
            color: "rgba(34, 197, 94, 0.5)",
            fillColor: "rgba(34, 197, 94, 0.1)",
            fillOpacity: 0.3,
          }).addTo(mapInstanceRef.current)
          safeZoneCircleRef.current = safeZoneCircle
        }
      } else {
        if (baseMarkerRef.current) {
          baseMarkerRef.current.remove()
          baseMarkerRef.current = null
        }

        if (safeZoneCircleRef.current) {
          safeZoneCircleRef.current.remove()
          safeZoneCircleRef.current = null
        }
      }
    }
  }, [showBaseLocation, safeRadius, baseLocation])

  const centerOnPatient = () => {
    if (mapInstanceRef.current && patientMarkerRef.current) {
      mapInstanceRef.current.setView(patientMarkerRef.current.getLatLng(), 15)
    }
  }

  const toggleBaseLocation = () => {
    setShowBaseLocation(!showBaseLocation)
  }

  const refreshLocation = () => {
    if (isSimulationMode) {
      // In simulation mode, just generate a new random position
      const newLat = patientLocation.lat + (Math.random() - 0.5) * 0.002
      const newLng = patientLocation.lng + (Math.random() - 0.5) * 0.002
      const newLocation = {
        lat: newLat,
        lng: newLng,
      }

      setPatientLocation(newLocation)
      setLastUpdated(new Date())

      // Calculate distance from base
      const distance = calculateDistance(newLat, newLng, baseLocation.lat, baseLocation.lng)
      setCurrentDistance(Math.round(distance))

      // Update marker position
      if (patientMarkerRef.current) {
        patientMarkerRef.current.setLatLng([newLat, newLng])
      }

      // Center map on new location
      if (mapInstanceRef.current) {
        mapInstanceRef.current.setView([newLat, newLng], mapInstanceRef.current.getZoom())
      }

      // Notify parent component
      if (onLocationUpdate) {
        onLocationUpdate({
          lat: newLat,
          lng: newLng,
          distance,
        })
      }
      return
    }

    // Try to get real location if not in simulation mode
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by your browser")
      return
    }

    try {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords
          const newLocation = {
            lat: latitude,
            lng: longitude,
          }

          setPatientLocation(newLocation)
          setLastUpdated(new Date())
          setLocationError(null)

          // Calculate distance from base
          const distance = calculateDistance(latitude, longitude, baseLocation.lat, baseLocation.lng)
          setCurrentDistance(Math.round(distance))

          // Update marker position
          if (patientMarkerRef.current) {
            patientMarkerRef.current.setLatLng([latitude, longitude])
          }

          // Center map on new location
          if (mapInstanceRef.current) {
            mapInstanceRef.current.setView([latitude, longitude], mapInstanceRef.current.getZoom())
          }

          // Notify parent component
          if (onLocationUpdate) {
            onLocationUpdate({
              lat: latitude,
              lng: longitude,
              distance,
            })
          }
        },
        (error) => {
          console.error("Error getting location:", error)
          if (!isSimulationMode) {
            setLocationError(`Geolocation access denied. Using simulation mode instead.`)
            startSimulationMode()
          }
        },
      )
    } catch (error) {
      console.error("Error accessing geolocation:", error)
      if (!isSimulationMode) {
        setLocationError("Error accessing geolocation. Using simulation mode instead.")
        startSimulationMode()
      }
    }
  }

  return (
    <div className="w-full h-full flex flex-col">
      {isLoading && (
        <div className="absolute inset-0 bg-white/80 z-10 flex items-center justify-center">
          <div className="flex flex-col items-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
            <p className="mt-2 text-sm text-muted-foreground">Getting your location...</p>
          </div>
        </div>
      )}
      {locationError && (
        <Alert variant="warning" className="mb-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{locationError}</AlertDescription>
        </Alert>
      )}

      {isSimulationMode && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-2 rounded-md mb-4">
          <div className="flex items-center">
            <AlertTriangle className="h-4 w-4 mr-2" />
            <span className="font-medium">Simulation Mode Active</span>
          </div>
          <p className="text-sm mt-1">Using simulated location data. This may happen when:</p>
          <ul className="text-sm list-disc list-inside ml-2 mt-1">
            <li>The site is not served over HTTPS</li>
            <li>Location permissions were denied</li>
            <li>You're viewing in a preview environment</li>
          </ul>
          <p className="text-sm mt-1">
            In a production environment with proper permissions, real location data would be used.
          </p>
        </div>
      )}

      <div className="relative flex-1">
        <div ref={mapRef} className="w-full h-full rounded-lg overflow-hidden"></div>
        {isSimulationMode && (
          <div className="absolute top-2 right-2 bg-amber-100 border border-amber-400 text-amber-700 px-2 py-1 rounded-md text-xs">
            Simulation Mode
          </div>
        )}
      </div>
      <div className="mt-4 flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Last updated: {lastUpdated.toLocaleTimeString()}</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-sm">Distance from base: {currentDistance}m</span>
          <Badge variant="outline">Safe radius: {safeRadius}m</Badge>
        </div>
      </div>
      <div className="mt-2 flex justify-center space-x-2">
        <Button variant="outline" size="sm" onClick={toggleBaseLocation}>
          <Home className="mr-2 h-4 w-4" />
          {showBaseLocation ? "Hide Base Location" : "Show Base Location"}
        </Button>
        <Button variant="outline" size="sm" onClick={centerOnPatient}>
          <MapPin className="mr-2 h-4 w-4" />
          Center on {isSimulationMode ? "Simulated" : "Current"} Location
        </Button>
        <Button variant="outline" size="sm" onClick={refreshLocation}>
          <Clock className="mr-2 h-4 w-4" />
          Refresh Location
        </Button>
      </div>
    </div>
  )
}

