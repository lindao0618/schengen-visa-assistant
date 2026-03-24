"use client"

import { useEffect, useState } from "react"

export function DevTools() {
  const [isActive, setIsActive] = useState(false)
  const [hoveredElement, setHoveredElement] = useState<HTMLElement | null>(null)
  const [selectedElement, setSelectedElement] = useState<HTMLElement | null>(null)

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === "Alt") {
        setIsActive(true)
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Alt") {
        setIsActive(false)
      }
    }

    const handleMouseOver = (e: MouseEvent) => {
      if (!isActive) return
      const target = e.target as HTMLElement
      if (target) {
        setHoveredElement(target)
        target.style.outline = "2px solid #3b82f6"
        const componentName = target.getAttribute("data-component-name")
        if (componentName) {
          console.log("Hovered component:", componentName)
        }
      }
    }

    const handleMouseOut = (e: MouseEvent) => {
      if (!isActive) return
      const target = e.target as HTMLElement
      if (target) {
        target.style.outline = ""
      }
    }

    const handleClick = (e: MouseEvent) => {
      if (!isActive) return
      e.preventDefault()
      const target = e.target as HTMLElement
      if (target) {
        setSelectedElement(target)
        const componentName = target.getAttribute("data-component-name")
        if (componentName) {
          console.log("Selected component:", componentName)
          // 这里可以添加更多信息，比如组件的props等
          console.log("Element:", target.outerHTML)
        }
      }
    }

    document.addEventListener("keydown", handleKeyPress)
    document.addEventListener("keyup", handleKeyUp)
    document.addEventListener("mouseover", handleMouseOver)
    document.addEventListener("mouseout", handleMouseOut)
    document.addEventListener("click", handleClick)

    return () => {
      document.removeEventListener("keydown", handleKeyPress)
      document.removeEventListener("keyup", handleKeyUp)
      document.removeEventListener("mouseover", handleMouseOver)
      document.removeEventListener("mouseout", handleMouseOut)
      document.removeEventListener("click", handleClick)
    }
  }, [isActive])

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-black/80 text-white px-4 py-2 rounded-lg text-sm">
      {isActive ? "开发工具已激活 (按住Alt键选择元素)" : "按住Alt键激活开发工具"}
    </div>
  )
}
