"use client"

import { useState } from "react"
import { Phone } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import MapComponent from "./MapComponent"

export default function PatientPage() {
  const [patientStatus, setPatientStatus] = useState("safe")
  const [currentDistance, setCurrentDistance] = useState(320)

  const handleEmergencyCall = () => {
    alert("Emergency call initiated. Contacting caretaker...")
    // In a real app, this would initiate a call or send an alert
  }

  return (
    <div className="container mx-auto py-10">
      <Card className="w-full max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle>Patient Monitoring</CardTitle>
          <CardDescription>Real-time status and location.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <div className="flex items-center space-x-4">
              <span>Status:</span>
              {patientStatus === "safe" && <span className="text-green-500 font-semibold">Safe</span>}
              {patientStatus === "warning" && <span className="text-yellow-500 font-semibold">Warning</span>}
              {patientStatus === "alert" && <span className="text-red-500 font-semibold">Alert</span>}
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm">Distance from base: {currentDistance}m</span>
            </div>
            <div className="border rounded-lg overflow-hidden h-[400px]">
              <div className="relative w-full h-full">
                <MapComponent
                  onLocationUpdate={(location) => {
                    // Update patient status based on distance from base
                    const distance = location.distance
                    setCurrentDistance(Math.round(distance))
                    if (distance > 500) {
                      setPatientStatus("alert")
                    } else if (distance > 400) {
                      setPatientStatus("warning")
                    } else {
                      setPatientStatus("safe")
                    }
                  }}
                  safeRadius={500}
                />
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end">
          <Button variant="outline" size="sm" onClick={handleEmergencyCall}>
            <Phone className="mr-2 h-4 w-4" />
            Emergency Call
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}

