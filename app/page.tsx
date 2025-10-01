"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Upload,
  Download,
  X,
  ImageIcon,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  Zap,
  ArrowRight,
  Check,
  Maximize2,
  ChevronRight,
  RotateCcw,
} from "lucide-react"

interface ImageDimensions {
  width: number
  height: number
}

export default function BackgroundReplacer() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const [resultBlob, setResultBlob] = useState<Blob | null>(null)
  const [originalBlob, setOriginalBlob] = useState<Blob | null>(null) // Store original image blob
  const [comparisonOriginalUrl, setComparisonOriginalUrl] = useState<string | null>(null) // Separate URL for comparison
  const [multiViewResults, setMultiViewResults] = useState<{
    front: string
    left: string
    right: string
    back: string
  } | null>(null)
  const [isLoadingMulti, setIsLoadingMulti] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [processingTime, setProcessingTime] = useState<number | null>(null)
  const [imageDimensions, setImageDimensions] = useState<ImageDimensions | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [multiViewStartTime, setMultiViewStartTime] = useState<number | null>(null)
  const [elapsedTime, setElapsedTime] = useState<number>(0)
  const [comparisonSliderPosition, setComparisonSliderPosition] = useState(50)
  const [isComparing, setIsComparing] = useState(false)
  const [currentStep, setCurrentStep] = useState(1)
  const [isDraggingSlider, setIsDraggingSlider] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropZoneRef = useRef<HTMLDivElement>(null)
  const comparisonContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      if (resultUrl) URL.revokeObjectURL(resultUrl)
      if (comparisonOriginalUrl) URL.revokeObjectURL(comparisonOriginalUrl)
    }
  }, [previewUrl, resultUrl, comparisonOriginalUrl])

  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null
    
    if (isLoadingMulti && multiViewStartTime) {
      intervalId = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - multiViewStartTime) / 1000))
      }, 1000)
    } else {
      setElapsedTime(0)
    }

    return () => {
      if (intervalId) clearInterval(intervalId)
    }
  }, [isLoadingMulti, multiViewStartTime])

  // Create fresh comparison URLs when entering comparison mode
  useEffect(() => {
    if (isComparing && originalBlob && resultBlob) {
      // Revoke old comparison URL if it exists
      if (comparisonOriginalUrl) {
        URL.revokeObjectURL(comparisonOriginalUrl)
      }
      
      // Create fresh URLs from blobs
      const freshOriginalUrl = URL.createObjectURL(originalBlob)
      setComparisonOriginalUrl(freshOriginalUrl)
      
      console.log("Created fresh comparison URLs:", {
        original: freshOriginalUrl,
        result: resultUrl,
        originalBlobSize: originalBlob.size,
        resultBlobSize: resultBlob.size
      })
    }
  }, [isComparing, originalBlob, resultBlob])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'c' && e.metaKey && resultUrl && originalBlob) {
        e.preventDefault()
        setIsComparing(!isComparing)
      }
      if (e.key === 'Enter' && selectedFile && !isLoading && !resultUrl) {
        e.preventDefault()
        onSubmit()
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [selectedFile, isLoading, resultUrl, originalBlob, isComparing])

  const validateFile = (file: File): string | null => {
    if (!file.type.startsWith("image/")) {
      return "Please select a valid image file"
    }
    if (file.size > 15 * 1024 * 1024) {
      return "File size must be less than 15MB"
    }
    return null
  }

  const getImageDimensions = (file: File): Promise<ImageDimensions> => {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        resolve({ width: img.width, height: img.height })
      }
      img.onerror = reject
      img.src = URL.createObjectURL(file)
    })
  }

  const onFileSelected = useCallback(
    async (file: File) => {
      const validationError = validateFile(file)
      if (validationError) {
        setError(validationError)
        return
      }

      setError(null)
      setSelectedFile(file)
      setCurrentStep(2)
    
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }

      const newPreviewUrl = URL.createObjectURL(file)
      setPreviewUrl(newPreviewUrl)

      // Store the original file as a blob for comparison later
      setOriginalBlob(file)
      console.log("Stored original image blob:", { size: file.size, type: file.type })

      try {
        const dimensions = await getImageDimensions(file)
        setImageDimensions(dimensions)
      } catch (error) {
        console.error("Failed to get image dimensions:", error)
      }
    },
    [previewUrl],
  )

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setDragActive(false)

      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        onFileSelected(e.dataTransfer.files[0])
      }
    },
    [onFileSelected],
  )

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
        onFileSelected(e.target.files[0])
      }
    },
    [onFileSelected],
  )

  const onSubmit = async () => {
    if (!selectedFile) {
      setError("Please select an image first")
      return
    }

    const webhookUrl = "https://tharunkalluru.app.n8n.cloud/webhook/imagebg"

    setIsLoading(true)
    setError(null)
    setSuccessMessage(null)
    setMultiViewResults(null)
    setResultBlob(null)
    setCurrentStep(2)
    const startTime = performance.now()

    try {
      const formData = new FormData()
      formData.append("file", selectedFile, selectedFile.name)

      const response = await fetch(webhookUrl, {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        let errorMessage = `Server error: ${response.status}`
        try {
          const errorText = await response.text()
          if (errorText) errorMessage += ` - ${errorText}`
        } catch (e) {
          // Ignore
        }
        throw new Error(errorMessage)
      }

      const blob = await response.blob()

      if (!blob.type.startsWith("image/")) {
        throw new Error("Unexpected response from server")
      }

      if (resultUrl) {
        URL.revokeObjectURL(resultUrl)
      }

      const newResultUrl = URL.createObjectURL(blob)
      setResultUrl(newResultUrl)
      setResultBlob(blob)
      setCurrentStep(3)

      const endTime = performance.now()
      setProcessingTime(Math.round(endTime - startTime))
      setSuccessMessage("Background removed successfully!")
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  const generateMultiViews = async () => {
    if (!resultBlob || isLoadingMulti) {
      return
    }

    const baseUrl = "https://tharunkalluru.app.n8n.cloud/webhook"
    const viewEndpoints = {
      front: `${baseUrl}/imagebg-front`,
      left: `${baseUrl}/imagebg-left`,
      right: `${baseUrl}/imagebg-right`,
      back: `${baseUrl}/imagebg-back`,
    }

    setIsLoadingMulti(true)
    setError(null)
    setSuccessMessage(null)
    setMultiViewStartTime(Date.now())
    setCurrentStep(4)

    try {
      const createFormData = () => {
        const fd = new FormData()
        fd.append("edited", resultBlob, "edited.jpg")
        return fd
      }

      console.log("Starting multi-view generation...")

      // Use Promise.allSettled to handle partial failures
      const results = await Promise.allSettled([
        fetch(viewEndpoints.front, { method: "POST", body: createFormData() }).then(r => ({ view: 'front', response: r })),
        fetch(viewEndpoints.left, { method: "POST", body: createFormData() }).then(r => ({ view: 'left', response: r })),
        fetch(viewEndpoints.right, { method: "POST", body: createFormData() }).then(r => ({ view: 'right', response: r })),
        fetch(viewEndpoints.back, { method: "POST", body: createFormData() }).then(r => ({ view: 'back', response: r })),
      ])

      console.log("Fetch results:", results.map((r, i) => ({
        view: ['front', 'left', 'right', 'back'][i],
        status: r.status,
        ok: r.status === 'fulfilled' ? r.value.response.ok : false
      })))

      const views: any = {}
      const failedViews: string[] = []
      let successCount = 0

      // Process each view independently
      for (const result of results) {
        if (result.status === 'fulfilled') {
          const { view, response } = result.value
          
          if (response.ok) {
            try {
              const blob = await response.blob()
              console.log(`${view} view: blob size = ${blob.size} bytes`)
              
              if (blob.size > 0) {
                views[view] = URL.createObjectURL(blob)
                successCount++
                console.log(`✓ ${view} view generated successfully`)
              } else {
                failedViews.push(view)
                console.error(`✗ ${view} view: empty blob`)
              }
            } catch (err) {
              failedViews.push(view)
              console.error(`✗ ${view} view: blob conversion failed`, err)
            }
          } else {
            failedViews.push(view)
            console.error(`✗ ${view} view: HTTP ${response.status}`)
          }
        } else {
          const viewName = ['front', 'left', 'right', 'back'][results.indexOf(result)]
          failedViews.push(viewName)
          console.error(`✗ ${viewName} view: request failed`, result.reason)
        }
      }

      if (successCount > 0) {
        setMultiViewResults(views)
        if (failedViews.length > 0) {
          setSuccessMessage(`${successCount} views generated successfully!`)
          setError(`Warning: ${failedViews.join(', ')} view(s) failed to generate`)
        } else {
          setSuccessMessage("All 4 views generated successfully!")
        }
      } else {
        throw new Error('All views failed to generate')
      }
    } catch (err) {
      console.error("Multi-view generation error:", err)
      setError(err instanceof Error ? err.message : "Failed to generate multi-views")
    } finally {
      setIsLoadingMulti(false)
      setMultiViewStartTime(null)
    }
  }

  const reset = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    if (resultUrl) URL.revokeObjectURL(resultUrl)

    setSelectedFile(null)
    setPreviewUrl(null)
    setResultUrl(null)
    setResultBlob(null)
    setMultiViewResults(null)
    setError(null)
    setSuccessMessage(null)
    setProcessingTime(null)
    setImageDimensions(null)
    setCurrentStep(1)
    setIsComparing(false)

    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const downloadResult = () => {
    if (!resultUrl || !selectedFile) return

    const link = document.createElement("a")
    link.href = resultUrl
    link.download = `bg-replaced-${selectedFile.name}`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const downloadMultiView = (view: string, viewName: string) => {
    if (!selectedFile) return

    const link = document.createElement("a")
    link.href = view
    link.download = `${viewName}-${selectedFile.name}`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  const updateSliderPosition = (clientX: number) => {
    if (!comparisonContainerRef.current) return
    const rect = comparisonContainerRef.current.getBoundingClientRect()
    const x = clientX - rect.left
    const percentage = (x / rect.width) * 100
    setComparisonSliderPosition(Math.max(0, Math.min(100, percentage)))
  }

  const handleComparisonSliderStart = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsDraggingSlider(true)
    updateSliderPosition(e.clientX)
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingSlider) {
        updateSliderPosition(e.clientX)
      }
    }

    const handleMouseUp = () => {
      setIsDraggingSlider(false)
    }

    if (isDraggingSlider) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDraggingSlider])

  const steps = [
    { num: 1, label: "Upload", active: currentStep >= 1, complete: currentStep > 1 },
    { num: 2, label: "Process", active: currentStep >= 2, complete: currentStep > 2 },
    { num: 3, label: "Download", active: currentStep >= 3, complete: currentStep > 3 },
  ]

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-black/80 backdrop-blur-2xl border-b border-neutral-200/50 dark:border-neutral-800/50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-black dark:bg-white rounded-lg flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-white dark:text-black" />
            </div>
            <span className="font-semibold text-lg">CatalogPro AI</span>
          </div>
          {selectedFile && (
            <Button
              variant="ghost"
              size="sm"
              onClick={reset}
              className="text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Start Over
            </Button>
          )}
        </div>
      </nav>

      {/* Main Content */}
      <main className="pt-24 pb-20 px-6">
        <div className="max-w-5xl mx-auto space-y-8">
          {/* Hero Section */}
          {!selectedFile && (
            <div className="text-center space-y-4 animate-in fade-in duration-700">
              <h1 className="text-6xl md:text-7xl font-bold tracking-tight">
                Transform Product
                <br />
                <span className="bg-gradient-to-r from-neutral-900 via-neutral-700 to-neutral-900 dark:from-neutral-100 dark:via-neutral-300 dark:to-neutral-100 bg-clip-text text-transparent">
                  Images with AI
                </span>
              </h1>
              <p className="text-xl text-neutral-500 dark:text-neutral-400 max-w-2xl mx-auto">
                Generate realistic views for your products
              </p>
            </div>
          )}

          {/* Progress Steps */}
          {selectedFile && (
            <div className="flex items-center justify-center gap-2">
              {steps.map((step, idx) => (
                <div key={step.num} className="flex items-center">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-medium transition-all duration-300 ${
                        step.complete
                          ? "bg-black dark:bg-white text-white dark:text-black"
                          : step.active
                          ? "bg-neutral-200 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                          : "bg-neutral-100 dark:bg-neutral-900 text-neutral-400"
                      }`}
                    >
                      {step.complete ? <Check className="h-5 w-5" /> : step.num}
                    </div>
                    <span
                      className={`text-sm font-medium ${
                        step.active ? "text-neutral-900 dark:text-neutral-100" : "text-neutral-400"
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>
                  {idx < steps.length - 1 && (
                    <ChevronRight className="h-5 w-5 text-neutral-300 dark:text-neutral-700 mx-2" />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Status Messages */}
          {error && (
            <Alert className="border-red-200 bg-red-50 dark:bg-red-950/20 animate-in fade-in slide-in-from-top duration-300">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-900 dark:text-red-200">{error}</AlertDescription>
            </Alert>
          )}

          {successMessage && (
            <Alert className="border-green-200 bg-green-50 dark:bg-green-950/20 animate-in fade-in slide-in-from-top duration-300">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-900 dark:text-green-200">{successMessage}</AlertDescription>
            </Alert>
          )}

          {/* Upload Section */}
          {!previewUrl ? (
            <div
              ref={dropZoneRef}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`
                group relative rounded-3xl p-20 text-center cursor-pointer transition-all duration-500 border-2
                ${
                  dragActive
                    ? "border-black dark:border-white bg-neutral-100 dark:bg-neutral-900 scale-[1.02] shadow-2xl"
                    : "border-dashed border-neutral-300 dark:border-neutral-700 hover:border-neutral-400 dark:hover:border-neutral-600 hover:bg-white dark:hover:bg-neutral-900 hover:shadow-xl"
                }
              `}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileInput}
                className="hidden"
              />
              <div className="space-y-6">
                <div className={`transition-all duration-500 ${dragActive ? 'scale-110' : 'group-hover:scale-105'}`}>
                  <Upload className="h-16 w-16 mx-auto text-neutral-400 transition-colors group-hover:text-neutral-600 dark:group-hover:text-neutral-300" />
                </div>
                <div className="space-y-2">
                  <p className="text-2xl font-semibold">
                    {dragActive ? "Drop it here!" : "Drop your image"}
                  </p>
                  <p className="text-neutral-500">
                    or click to browse • PNG, JPG, WEBP • Max 15MB
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6 animate-in fade-in duration-500">
              {/* File Info */}
              <div className="flex items-center justify-between p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-gradient-to-br from-neutral-900 to-neutral-700 dark:from-neutral-100 dark:to-neutral-300">
                    <ImageIcon className="h-5 w-5 text-white dark:text-black" />
                  </div>
                  <div>
                    <p className="font-medium text-lg">{selectedFile?.name}</p>
                    <p className="text-sm text-neutral-500">
                      {selectedFile && formatFileSize(selectedFile.size)}
                      {imageDimensions && ` • ${imageDimensions.width}×${imageDimensions.height}`}
                    </p>
                  </div>
                </div>
              </div>

              {/* Comparison View */}
              {resultUrl && previewUrl && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Result</h3>
                    <div className="flex items-center gap-2">
                      <Button
                        variant={isComparing ? "default" : "outline"}
                        size="sm"
                        onClick={() => setIsComparing(!isComparing)}
                        className={isComparing ? "bg-black dark:bg-white text-white dark:text-black" : ""}
                      >
                        <Maximize2 className="h-3 w-3 mr-2" />
                        Compare
                      </Button>
                      {processingTime && (
                        <span className="text-xs text-neutral-500 bg-neutral-100 dark:bg-neutral-800 px-3 py-1.5 rounded-full">
                          {processingTime}ms
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Comparison Slider */}
                  {isComparing ? (
                    <div
                      ref={comparisonContainerRef}
                      className="relative rounded-2xl overflow-hidden bg-neutral-100 dark:bg-neutral-900 h-[600px] cursor-col-resize select-none"
                      onMouseDown={handleComparisonSliderStart}
                    >
                      {/* Original Image - Base Layer */}
                      <img
                        src={comparisonOriginalUrl || previewUrl}
                        alt="Original"
                        className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                        onLoad={() => console.log("Comparison original image loaded")}
                        onError={(e) => {
                          console.error("Failed to load comparison original image")
                          console.log("Attempted URL:", comparisonOriginalUrl || previewUrl)
                        }}
                      />
                      
                      {/* Processed Image - Clipped Layer on Top */}
                      <div 
                        className="absolute inset-0 overflow-hidden"
                        style={{ clipPath: `polygon(0 0, ${comparisonSliderPosition}% 0, ${comparisonSliderPosition}% 100%, 0 100%)` }}
                      >
                        <img
                          src={resultUrl}
                          alt="Processed"
                          className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                          onLoad={() => console.log("Comparison result image loaded")}
                          onError={() => console.error("Failed to load comparison result image")}
                        />
                      </div>
                      
                      {/* Slider Handle */}
                      <div
                        className="absolute top-0 bottom-0 w-1 bg-white shadow-2xl pointer-events-none z-20"
                        style={{ left: `${comparisonSliderPosition}%` }}
                      >
                        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center transition-all ${isDraggingSlider ? 'scale-110 ring-4 ring-black/20' : ''}`}>
                          <div className="flex gap-1">
                            <div className="w-0.5 h-4 bg-neutral-400" />
                            <div className="w-0.5 h-4 bg-neutral-400" />
                          </div>
                        </div>
                      </div>
                      
                      {/* Labels */}
                      <div className="absolute top-4 left-4 bg-black/70 backdrop-blur-sm text-white px-3 py-1.5 rounded-full text-xs font-medium pointer-events-none z-20">
                        Original
                      </div>
                      <div className="absolute top-4 right-4 bg-black/70 backdrop-blur-sm text-white px-3 py-1.5 rounded-full text-xs font-medium pointer-events-none z-20">
                        Processed
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-2xl overflow-hidden bg-neutral-100 dark:bg-neutral-900 h-[600px] flex items-center justify-center">
                      <img
                        src={resultUrl}
                        alt="Processed"
                        className="max-w-full max-h-full object-contain"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Loading or Empty State */}
              {!resultUrl && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Preview</h3>
                  {isLoading ? (
                    <div className="rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 h-[600px] flex items-center justify-center">
                      <div className="text-center space-y-4">
                        <Loader2 className="h-10 w-10 mx-auto animate-spin text-neutral-400" />
                        <div>
                          <p className="font-medium">Processing your image</p>
                          <p className="text-sm text-neutral-500">This usually takes a few seconds</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-2xl overflow-hidden bg-neutral-100 dark:bg-neutral-900 h-[600px] flex items-center justify-center">
                      <img
                        src={previewUrl}
                        alt="Original"
                        className="max-w-full max-h-full object-contain"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Quick Actions */}
              <div className="flex gap-3">
                {!resultUrl ? (
                  <Button
                    onClick={onSubmit}
                    disabled={isLoading}
                    className="flex-1 h-14 text-base bg-black hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-200 text-white dark:text-black font-medium shadow-lg hover:shadow-xl transition-all duration-300"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                        Processing
                      </>
                    ) : (
                      <>
                        <Zap className="h-5 w-5 mr-2" />
                        Transform Image
                        <kbd className="ml-auto hidden sm:inline-flex h-6 px-2 items-center gap-1 rounded bg-white/20 text-xs">
                          <span>↵</span>
                        </kbd>
                      </>
                    )}
                  </Button>
                ) : (
                  <>
                    <Button
                      onClick={downloadResult}
                      className="flex-1 h-14 text-base bg-black hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-200 text-white dark:text-black font-medium"
                    >
                      <Download className="h-5 w-5 mr-2" />
                      Download Image
                    </Button>
                    {!multiViewResults && !isLoadingMulti && (
                      <Button
                        onClick={generateMultiViews}
                        className="flex-1 h-14 text-base border-2 border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-800 font-medium"
                        variant="outline"
                      >
                        <Sparkles className="h-5 w-5 mr-2" />
                        Generate 4 Views
                      </Button>
                    )}
                  </>
                )}
              </div>

              {/* Multi-View Loading */}
              {isLoadingMulti && (
                <div className="rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-10 text-center space-y-6 animate-in fade-in duration-300">
                  <Loader2 className="h-12 w-12 mx-auto animate-spin text-neutral-400" />
                  <div className="space-y-2">
                    <p className="text-lg font-semibold">Generating multi-angle views</p>
                    <p className="text-sm text-neutral-500">
                      {elapsedTime}s elapsed
                      {elapsedTime < 30 && " • Starting up..."}
                      {elapsedTime >= 30 && elapsedTime < 90 && " • Creating views..."}
                      {elapsedTime >= 90 && " • Almost there!"}
                    </p>
                  </div>
                  <div className="max-w-sm mx-auto h-2 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-neutral-400 to-neutral-600 transition-all duration-1000"
                      style={{ width: `${Math.min((elapsedTime / 180) * 100, 95)}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Multi-View Results */}
              {multiViewResults && (
                <div className="space-y-6 animate-in fade-in duration-500">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Multi-Angle Views</h3>
                    <span className="text-sm text-neutral-500 bg-neutral-100 dark:bg-neutral-800 px-3 py-1.5 rounded-full">
                      {Object.keys(multiViewResults).length} of 4 views generated
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {(['front', 'left', 'right', 'back'] as const).map((view) => (
                      <div key={view} className="group space-y-3">
                        <div className="relative rounded-xl overflow-hidden bg-neutral-100 dark:bg-neutral-900 aspect-square hover:ring-2 hover:ring-neutral-300 dark:hover:ring-neutral-700 transition-all duration-300">
                          {multiViewResults[view] ? (
                            <>
                              <img
                                src={multiViewResults[view]}
                                alt={`${view} view`}
                                className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                                onLoad={() => console.log(`${view} view image rendered successfully`)}
                                onError={() => console.error(`${view} view image failed to render`)}
                              />
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors duration-300" />
                            </>
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-neutral-400 space-y-2">
                              <AlertCircle className="h-8 w-8" />
                              <p className="text-xs">Failed to load</p>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center justify-between px-2">
                          <p className="text-sm font-medium capitalize">{view}</p>
                          {multiViewResults[view] && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => downloadMultiView(multiViewResults[view], view)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Footer with Keyboard Shortcuts */}
      <footer className="fixed bottom-0 left-0 right-0 bg-white/60 dark:bg-black/60 backdrop-blur-2xl border-t border-neutral-200/50 dark:border-neutral-800/50">
        <div className="max-w-7xl mx-auto px-6 h-12 flex items-center justify-between text-xs text-neutral-500">
          <p>Powered by AI</p>
          {selectedFile && resultUrl && (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <kbd className="px-2 py-1 rounded bg-neutral-100 dark:bg-neutral-800 font-mono">⌘</kbd>
                <kbd className="px-2 py-1 rounded bg-neutral-100 dark:bg-neutral-800 font-mono">C</kbd>
                <span>Compare</span>
              </div>
            </div>
          )}
        </div>
      </footer>
    </div>
  )
}
