"use client"

import { useState, useEffect } from "react"
import { Moon, Sun } from "lucide-react"

export function ThemeToggle() {
  const [darkMode, setDarkMode] = useState(false)

  useEffect(() => {
    const isDarkMode = localStorage.getItem("darkMode") === "true"
    setDarkMode(isDarkMode)
    document.documentElement.classList.toggle("dark", isDarkMode)
  }, [])

  const toggleDarkMode = () => {
    const newDarkMode = !darkMode
    setDarkMode(newDarkMode)
    localStorage.setItem("darkMode", newDarkMode.toString())
    document.documentElement.classList.toggle("dark", newDarkMode)
  }

  return (
    <button onClick={toggleDarkMode} className="p-2 rounded-full bg-gray-200 dark:bg-gray-700">
      {darkMode ? <Sun size={20} /> : <Moon size={20} />}
    </button>
  )
}

