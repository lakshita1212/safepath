"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { MapPin, Phone, User, Home } from "lucide-react"

export default function PatientViewPage() {
  const [showIdentity, setShowIdentity] = useState(false)

  return (
    <div className="container flex items-center justify-center min-h-screen py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Patient View</CardTitle>
          <CardDescription>Simple interface for the patient to use</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {showIdentity ? (
            <div className="flex flex-col items-center justify-center space-y-4 py-4">
              <Avatar className="h-24 w-24">
                <AvatarImage src="/placeholder.svg" alt="Patient" />
                <AvatarFallback>JD</AvatarFallback>
              </Avatar>
              <div className="text-center">
                <h3 className="font-medium text-lg">John Doe</h3>
                <p className="text-muted-foreground">Patient ID: #12345</p>
              </div>
              <div className="w-full space-y-2">
                <div className="flex justify-between">
                  <p className="text-sm font-medium">Caretaker:</p>
                  <p className="text-sm">Jane Smith</p>
                </div>
                <div className="flex justify-between">
                  <p className="text-sm font-medium">Relationship:</p>
                  <p className="text-sm">Family Member</p>
                </div>
                <div className="flex justify-between">
                  <p className="text-sm font-medium">Home Address:</p>
                  <p className="text-sm">123 Main St</p>
                </div>
              </div>
              <Button className="w-full mt-4" onClick={() => setShowIdentity(false)}>
                Back to Main View
              </Button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4">
                <Button size="lg" className="h-20 text-lg" onClick={() => setShowIdentity(true)}>
                  <User className="mr-2 h-6 w-6" />
                  Who am I?
                </Button>

                <Button variant="outline" size="lg" className="h-20 text-lg">
                  <Phone className="mr-2 h-6 w-6" />
                  Call My Caretaker
                </Button>

                <Button variant="secondary" size="lg" className="h-20 text-lg">
                  <Home className="mr-2 h-6 w-6" />
                  Directions Home
                </Button>
              </div>

              <div className="border rounded-lg p-4 h-48 bg-muted flex items-center justify-center">
                <div className="text-center">
                  <MapPin className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">Your current location</p>
                  <p className="text-sm font-medium mt-2">You are 320 meters from home</p>
                </div>
              </div>
            </>
          )}
        </CardContent>
        <CardFooter className="flex justify-center">
          <p className="text-sm text-muted-foreground">If you need help, press the "Call My Caretaker" button</p>
        </CardFooter>
      </Card>
    </div>
  )
}

