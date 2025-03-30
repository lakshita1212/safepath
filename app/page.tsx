import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function Home() {
  return (
    <div className="container flex flex-col items-center justify-center min-h-screen py-12 space-y-8">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold tracking-tight">SafePath</h1>
        <p className="text-xl text-muted-foreground max-w-2xl">
          A caring solution to help you keep track of your loved ones
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 w-full max-w-5xl">
        <Card>
          <CardHeader>
            <CardTitle>Easy Setup</CardTitle>
            <CardDescription>Create an account and set up in minutes</CardDescription>
          </CardHeader>
          <CardContent>
            <p>Quick and simple registration process for caretakers to set up monitoring for their patients.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Location Tracking</CardTitle>
            <CardDescription>Know where your loved ones are</CardDescription>
          </CardHeader>
          <CardContent>
            <p>Set a safe radius and receive alerts when your patient wanders outside the designated area.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Patient Support</CardTitle>
            <CardDescription>Help when it's needed most</CardDescription>
          </CardHeader>
          <CardContent>
            <p>Simple "Who is this?" feature helps patients identify themselves and contact their caretaker.</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-4">
        <Button asChild size="lg">
          <Link href="/register">Get Started</Link>
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link href="/login">Login</Link>
        </Button>
      </div>
    </div>
  )
}

