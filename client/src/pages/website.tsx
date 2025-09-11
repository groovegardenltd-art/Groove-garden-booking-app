import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Music, Clock, Shield, CreditCard, Users, MapPin, Phone, Mail, Star, Leaf, Flower2, TreePine } from "lucide-react";
import grooveGardenLogo from "@/assets/groove-garden-logo.jpeg";

export default function Website() {
  const [activeTab, setActiveTab] = useState("studios");

  const studios = [
    {
      name: "Pod 1",
      description: "Perfect for bands and loud rehearsals",
      equipment: ["Full drum kit", "4-channel mixer", "Vocal microphones", "Amplifiers"],
      price: "£7/hr (9am-5pm) • £9/hr (5pm-midnight)",
      capacity: "Up to 5 people",
      image: "🥁"
    },
    {
      name: "Pod 2", 
      description: "Ideal for acoustic sessions and recording",
      equipment: ["Yamaha P-125 Digital Piano", "Audio Interface & Monitors", "Condenser Microphones", "Acoustic Treatment"],
      price: "£7/hr (9am-5pm) • £9/hr (5pm-midnight)",
      capacity: "Up to 8 people",
      image: "🎹"
    },
    {
      name: "Live Room",
      description: "Large space for bigger bands and performances",
      equipment: ["Full backline", "PA system", "Lighting rig", "Stage monitors"],
      price: "£13/hr (9am-5pm) • £18/hr (5pm-midnight)", 
      capacity: "Up to 12 people",
      image: "🎸"
    }
  ];

  const pricing = [
    { 
      title: "Pod 1 & 2", 
      description: "Time-based pricing",
      rates: [
        { time: "9am - 5pm", price: "£7/hour", type: "day" },
        { time: "5pm - midnight", price: "£9/hour", type: "evening" }
      ]
    },
    { 
      title: "Live Room", 
      description: "Time-based pricing",
      rates: [
        { time: "9am - 5pm", price: "£13/hour", type: "day" },
        { time: "5pm - midnight", price: "£18/hour", type: "evening" }
      ]
    }
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
      description: "Book 1-12 hours with 10% discount on sessions over 4 hours"
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
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100">
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
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Groove Garden</h1>
                <p className="text-sm text-gray-600">Music Rehearsal Studios</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Link href="/login">
                <Button variant="outline">Login</Button>
              </Link>
              <Link href="/">
                <Button className="bg-green-600 hover:bg-green-700">
                  Book Now
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 px-4 relative overflow-hidden">
        {/* Decorative plants */}
        <div className="absolute top-10 left-10 text-green-200/30">
          <Leaf className="w-16 h-16 rotate-45" />
        </div>
        <div className="absolute top-20 right-20 text-green-300/40">
          <Flower2 className="w-12 h-12 rotate-12" />
        </div>
        <div className="absolute bottom-10 left-1/4 text-emerald-200/30">
          <TreePine className="w-20 h-20 -rotate-12" />
        </div>
        <div className="absolute bottom-20 right-10 text-green-200/40">
          <Leaf className="w-14 h-14 rotate-90" />
        </div>
        
        <div className="container mx-auto text-center relative z-10">
          <div className="flex items-center justify-center mb-6">
            <Leaf className="w-8 h-8 text-green-600 mr-3 rotate-45" />
            <h2 className="text-5xl font-bold text-gray-900">
              Professional Music Rehearsal Studios
            </h2>
            <Flower2 className="w-8 h-8 text-green-600 ml-3" />
          </div>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Book premium rehearsal spaces with state-of-the-art equipment, secure access, 
            and flexible scheduling. Perfect for bands, solo artists, and music creators.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/">
              <Button size="lg" className="bg-green-600 hover:bg-green-700">
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
      <section className="py-16 px-4 bg-white/50 relative">
        {/* Decorative flowers */}
        <div className="absolute top-10 right-10 text-green-200/20">
          <Flower2 className="w-24 h-24 rotate-45" />
        </div>
        <div className="absolute bottom-10 left-10 text-emerald-200/20">
          <Leaf className="w-20 h-20 -rotate-45" />
        </div>
        
        <div className="container mx-auto relative z-10">
          <div className="flex items-center justify-center mb-12">
            <TreePine className="w-6 h-6 text-green-600 mr-3" />
            <h3 className="text-3xl font-bold text-center text-gray-900">
              Why Choose Groove Garden?
            </h3>
            <Leaf className="w-6 h-6 text-green-600 ml-3 rotate-12" />
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="text-center border-0 shadow-lg">
                <CardHeader>
                  <div className="mx-auto w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center text-green-600 mb-4">
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
      <section id="studios" className="py-16 px-4 relative">
        {/* Garden elements around studios */}
        <div className="absolute top-0 left-20 text-green-200/30">
          <Flower2 className="w-16 h-16 rotate-12" />
        </div>
        <div className="absolute top-40 right-0 text-emerald-200/25">
          <TreePine className="w-18 h-18" />
        </div>
        <div className="absolute bottom-20 left-0 text-green-300/30">
          <Leaf className="w-12 h-12 rotate-45" />
        </div>
        
        <div className="container mx-auto relative z-10">
          <div className="flex items-center justify-center mb-12">
            <Flower2 className="w-6 h-6 text-green-600 mr-3 rotate-12" />
            <h3 className="text-3xl font-bold text-center text-gray-900">
              Our Studios
            </h3>
            <TreePine className="w-6 h-6 text-green-600 ml-3" />
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {studios.map((studio, index) => (
              <Card key={index} className="overflow-hidden shadow-lg hover:shadow-xl transition-shadow relative group">
                {/* Small decorative plants on cards */}
                <div className="absolute top-2 right-2 text-green-200/40 group-hover:text-green-300/60 transition-colors">
                  {index % 3 === 0 && <Leaf className="w-4 h-4 rotate-45" />}
                  {index % 3 === 1 && <Flower2 className="w-4 h-4" />}
                  {index % 3 === 2 && <TreePine className="w-4 h-4" />}
                </div>
                <CardHeader className="text-center">
                  <div className="text-6xl mb-4">{studio.image}</div>
                  <CardTitle className="text-xl flex items-center justify-center">
                    {studio.name}
                    {index === 0 && <Leaf className="w-4 h-4 text-green-500 ml-2 rotate-12" />}
                    {index === 1 && <Flower2 className="w-4 h-4 text-green-500 ml-2" />}
                    {index === 2 && <TreePine className="w-4 h-4 text-green-500 ml-2" />}
                  </CardTitle>
                  <CardDescription>{studio.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-2xl font-bold text-green-600">{studio.price}</span>
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
                    <Button className="w-full bg-green-600 hover:bg-green-700">
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
            Time-based hourly rates • 10% discount on bookings over 4 hours
          </p>
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {pricing.map((section, index) => (
              <Card key={index} className="shadow-lg">
                <CardHeader className="text-center">
                  <CardTitle className="text-xl text-green-600">{section.title}</CardTitle>
                  <CardDescription>{section.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {section.rates.map((rate, rateIndex) => (
                      <div key={rateIndex} className="flex justify-between items-center p-3 rounded-lg bg-gray-50">
                        <span className="font-medium">
                          {(rate as any).time || (rate as any).duration}
                        </span>
                        <div className="text-right">
                          <div className="font-bold text-green-600">{rate.price}</div>
                          {(rate as any).savings && (
                            <Badge variant="secondary" className="text-xs">
                              {(rate as any).savings}
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
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
      <section className="py-16 px-4 bg-white/50 relative">
        {/* Garden border elements */}
        <div className="absolute top-5 left-5 text-green-200/30">
          <Flower2 className="w-10 h-10 rotate-45" />
        </div>
        <div className="absolute top-5 right-5 text-emerald-200/30">
          <Leaf className="w-12 h-12 -rotate-12" />
        </div>
        <div className="absolute bottom-5 left-1/3 text-green-300/30">
          <TreePine className="w-8 h-8" />
        </div>
        <div className="absolute bottom-5 right-1/3 text-green-200/30">
          <Flower2 className="w-10 h-10 rotate-90" />
        </div>
        
        <div className="container mx-auto text-center relative z-10">
          <div className="flex items-center justify-center mb-8">
            <Leaf className="w-6 h-6 text-green-600 mr-3 rotate-45" />
            <h3 className="text-3xl font-bold text-gray-900">
              Get In Touch
            </h3>
            <Flower2 className="w-6 h-6 text-green-600 ml-3" />
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-3xl mx-auto">
            <div className="flex flex-col items-center">
              <MapPin className="w-8 h-8 text-green-600 mb-3" />
              <h4 className="font-semibold mb-2">Location</h4>
              <p className="text-gray-600">123 Music Street<br />London, UK</p>
            </div>
            <div className="flex flex-col items-center">
              <Phone className="w-8 h-8 text-green-600 mb-3" />
              <h4 className="font-semibold mb-2">Phone</h4>
              <p className="text-gray-600">+44 20 1234 5678</p>
            </div>
            <div className="flex flex-col items-center">
              <Mail className="w-8 h-8 text-green-600 mb-3" />
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
                  <h4 className="font-bold flex items-center">
                    Groove Garden
                    <Leaf className="w-4 h-4 text-green-500 ml-2 rotate-12" />
                  </h4>
                  <p className="text-sm text-gray-400 flex items-center">
                    Music Rehearsal Studios
                    <Flower2 className="w-3 h-3 text-green-400 ml-2" />
                  </p>
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
                <li>Monday - Friday: 9AM - Midnight</li>
                <li>Saturday: 9AM - Midnight</li>
                <li>Sunday: Closed</li>
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