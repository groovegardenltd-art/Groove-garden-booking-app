import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Music, Clock, Shield, CreditCard, Users, MapPin, Phone, Mail, Star } from "lucide-react";
import grooveGardenLogo from "@/assets/groove-garden-logo.jpeg";

export default function Website() {
  const [activeTab, setActiveTab] = useState("studios");

  const studios = [
    {
      name: "Studio A",
      description: "Perfect for bands and loud rehearsals",
      equipment: ["Full drum kit", "4-channel mixer", "Vocal microphones", "Amplifiers"],
      price: "£40/hour",
      capacity: "Up to 5 people",
      image: "🥁"
    },
    {
      name: "Studio B", 
      description: "Ideal for acoustic sessions and recording",
      equipment: ["Yamaha P-125 Digital Piano", "Audio Interface & Monitors", "Condenser Microphones", "Acoustic Treatment"],
      price: "£40/hour",
      capacity: "Up to 8 people",
      image: "🎹"
    },
    {
      name: "Studio C",
      description: "Large space for bigger bands and performances",
      equipment: ["Full backline", "PA system", "Lighting rig", "Stage monitors"],
      price: "£40/hour", 
      capacity: "Up to 12 people",
      image: "🎸"
    }
  ];

  const pricing = [
    { duration: "1 Hour", price: "£40", popular: false },
    { duration: "2 Hours", price: "£75", savings: "Save £5", popular: true },
    { duration: "3 Hours", price: "£105", savings: "Save £15", popular: false },
    { duration: "4 Hours", price: "£135", savings: "Save £25", popular: false }
  ];

  const features = [
    {
      icon: <Shield className="w-6 h-6" />,
      title: "Secure Access",
      description: "Smart lock technology with temporary access codes for your booking times"
    },
    {
      icon: <CreditCard className="w-6 h-6" />,
      title: "Easy Payment",
      description: "Secure online payments with Stripe - pay when you book"
    },
    {
      icon: <Clock className="w-6 h-6" />,
      title: "Flexible Booking",
      description: "Book 1-4 hours with bulk discounts for longer sessions"
    },
    {
      icon: <Users className="w-6 h-6" />,
      title: "ID Verification",
      description: "Safe and secure access with ID verification for studio entry"
    }
  ];

  const testimonials = [
    {
      name: "Sarah M.",
      band: "The Midnight Echoes",
      text: "Amazing facilities and the smart lock system is so convenient. No more waiting around for keys!",
      rating: 5
    },
    {
      name: "James L.",
      band: "Solo Artist",
      text: "Studio B is perfect for my acoustic sessions. Great sound quality and easy booking process.",
      rating: 5
    },
    {
      name: "Mike R.",
      band: "Rock Steady",
      text: "We've been using Studio A for months. The equipment is top-notch and pricing is fair.",
      rating: 5
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <img 
                src={grooveGardenLogo} 
                alt="Groove Garden Studio" 
                className="w-12 h-12 rounded-lg object-cover"
              />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Groove Garden</h1>
                <p className="text-sm text-gray-600">Music Rehearsal Studios</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Link href="/login">
                <Button variant="outline">Login</Button>
              </Link>
              <Link href="/">
                <Button className="bg-music-purple hover:bg-music-purple/90">
                  Book Now
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto text-center">
          <h2 className="text-5xl font-bold text-gray-900 mb-6">
            Professional Music Rehearsal Studios
          </h2>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Book premium rehearsal spaces with state-of-the-art equipment, secure access, 
            and flexible scheduling. Perfect for bands, solo artists, and music creators.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/">
              <Button size="lg" className="bg-music-purple hover:bg-music-purple/90">
                <Music className="w-5 h-5 mr-2" />
                Start Booking
              </Button>
            </Link>
            <Button 
              size="lg" 
              variant="outline"
              onClick={() => document.getElementById('studios')?.scrollIntoView({ behavior: 'smooth' })}
            >
              View Studios
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 px-4 bg-white/50">
        <div className="container mx-auto">
          <h3 className="text-3xl font-bold text-center text-gray-900 mb-12">
            Why Choose Groove Garden?
          </h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="text-center border-0 shadow-lg">
                <CardHeader>
                  <div className="mx-auto w-12 h-12 bg-music-purple/10 rounded-lg flex items-center justify-center text-music-purple mb-4">
                    {feature.icon}
                  </div>
                  <CardTitle className="text-lg">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>{feature.description}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Studios Section */}
      <section id="studios" className="py-16 px-4">
        <div className="container mx-auto">
          <h3 className="text-3xl font-bold text-center text-gray-900 mb-12">
            Our Studios
          </h3>
          <div className="grid md:grid-cols-3 gap-8">
            {studios.map((studio, index) => (
              <Card key={index} className="overflow-hidden shadow-lg hover:shadow-xl transition-shadow">
                <CardHeader className="text-center">
                  <div className="text-6xl mb-4">{studio.image}</div>
                  <CardTitle className="text-xl">{studio.name}</CardTitle>
                  <CardDescription>{studio.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-2xl font-bold text-music-purple">{studio.price}</span>
                    <Badge variant="secondary">{studio.capacity}</Badge>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">Equipment:</h4>
                    <ul className="text-sm text-gray-600 space-y-1">
                      {studio.equipment.map((item, i) => (
                        <li key={i}>• {item}</li>
                      ))}
                    </ul>
                  </div>
                  <Link href="/">
                    <Button className="w-full bg-music-purple hover:bg-music-purple/90">
                      Book {studio.name}
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-16 px-4 bg-white/50">
        <div className="container mx-auto">
          <h3 className="text-3xl font-bold text-center text-gray-900 mb-4">
            Transparent Pricing
          </h3>
          <p className="text-center text-gray-600 mb-12">
            Book longer sessions and save with our bulk pricing discounts
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-4xl mx-auto">
            {pricing.map((tier, index) => (
              <Card key={index} className={`relative ${tier.popular ? 'ring-2 ring-music-purple shadow-lg' : ''}`}>
                {tier.popular && (
                  <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-music-purple">
                    Most Popular
                  </Badge>
                )}
                <CardHeader className="text-center">
                  <CardTitle className="text-lg">{tier.duration}</CardTitle>
                  <div className="text-3xl font-bold text-music-purple">{tier.price}</div>
                  {tier.savings && (
                    <Badge variant="secondary" className="text-green-600">
                      {tier.savings}
                    </Badge>
                  )}
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-16 px-4">
        <div className="container mx-auto">
          <h3 className="text-3xl font-bold text-center text-gray-900 mb-12">
            What Musicians Say
          </h3>
          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <Card key={index} className="shadow-lg">
                <CardHeader>
                  <div className="flex items-center space-x-1 mb-2">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                  <CardDescription className="text-base italic">
                    "{testimonial.text}"
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div>
                    <p className="font-semibold">{testimonial.name}</p>
                    <p className="text-sm text-gray-600">{testimonial.band}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="py-16 px-4 bg-white/50">
        <div className="container mx-auto text-center">
          <h3 className="text-3xl font-bold text-gray-900 mb-8">
            Get In Touch
          </h3>
          <div className="grid md:grid-cols-3 gap-8 max-w-3xl mx-auto">
            <div className="flex flex-col items-center">
              <MapPin className="w-8 h-8 text-music-purple mb-3" />
              <h4 className="font-semibold mb-2">Location</h4>
              <p className="text-gray-600">123 Music Street<br />London, UK</p>
            </div>
            <div className="flex flex-col items-center">
              <Phone className="w-8 h-8 text-music-purple mb-3" />
              <h4 className="font-semibold mb-2">Phone</h4>
              <p className="text-gray-600">+44 20 1234 5678</p>
            </div>
            <div className="flex flex-col items-center">
              <Mail className="w-8 h-8 text-music-purple mb-3" />
              <h4 className="font-semibold mb-2">Email</h4>
              <p className="text-gray-600">hello@groovegarden.co.uk</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12 px-4">
        <div className="container mx-auto">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-3 mb-4">
                <img 
                  src={grooveGardenLogo} 
                  alt="Groove Garden Studio" 
                  className="w-10 h-10 rounded-lg object-cover"
                />
                <div>
                  <h4 className="font-bold">Groove Garden</h4>
                  <p className="text-sm text-gray-400">Music Rehearsal Studios</p>
                </div>
              </div>
              <p className="text-gray-400 text-sm">
                Professional rehearsal spaces for musicians of all levels.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Quick Links</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/" className="text-gray-400 hover:text-white">Book Studios</Link></li>
                <li><Link href="/login" className="text-gray-400 hover:text-white">Login</Link></li>
                <li><a href="#studios" className="text-gray-400 hover:text-white">Our Studios</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Contact</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li>123 Music Street, London</li>
                <li>+44 20 1234 5678</li>
                <li>hello@groovegarden.co.uk</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Hours</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li>Monday - Friday: 9AM - 11PM</li>
                <li>Saturday: 10AM - 11PM</li>
                <li>Sunday: 10AM - 9PM</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-700 mt-8 pt-8 text-center text-sm text-gray-400">
            <p>&copy; 2025 Groove Garden Studios. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}