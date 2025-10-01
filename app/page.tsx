"use client"

import type React from "react"

import { useState, useRef, useCallback, useEffect } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel"
import { Upload, Download, RotateCcw, ImageIcon, Loader2, AlertCircle, CheckCircle2, Sparkles } from "lucide-react"

interface ImageDimensions {
  width: number
  height: number
}

interface MultiViewResponse {
  success: boolean
  mode?: string
  front_b64?: string
  left_b64?: string
  right_b64?: string
  back_b64?: string
}

export default function BackgroundReplacer() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const [resultBlob, setResultBlob] = useState<Blob | null>(null)
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

  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropZoneRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      if (resultUrl) URL.revokeObjectURL(resultUrl)
    }
  }, [])

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

      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }

      const newPreviewUrl = URL.createObjectURL(file)
      setPreviewUrl(newPreviewUrl)

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
          // Ignore parsing errors
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

      const endTime = performance.now()
      setProcessingTime(Math.round(endTime - startTime))
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

    const webhookUrl = "https://tharunkalluru.app.n8n.cloud/webhook/imagebg-multi"

    setIsLoadingMulti(true)
    setError(null)
    setSuccessMessage(null)

    try {
      const formData = new FormData()
      formData.append("file", resultBlob, "edited.jpg")

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
          // Ignore parsing errors
        }
        throw new Error(errorMessage)
      }

      const data: MultiViewResponse = await response.json()

      if (!data.success) {
        throw new Error("Failed to generate multi-view images")
      }

      const views = {
        front: data.front_b64 ? `data:image/jpeg;base64,${data.front_b64}` : "",
        left: data.left_b64 ? `data:image/jpeg;base64,${data.left_b64}` : "",
        right: data.right_b64 ? `data:image/jpeg;base64,${data.right_b64}` : "",
        back: data.back_b64 ? `data:image/jpeg;base64,${data.back_b64}` : "",
      }

      const missingViews = Object.entries(views)
        .filter(([_, url]) => !url)
        .map(([view]) => view)

      if (missingViews.length > 0) {
        setError(`Warning: Some views were not generated: ${missingViews.join(", ")}`)
      }

      setMultiViewResults(views)
      setSuccessMessage("Successfully generated 4 views")
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred")
    } finally {
      setIsLoadingMulti(false)
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

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto p-6">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-foreground mb-4 text-balance">CatalogPro AI</h1>
          <p className="text-lg text-muted-foreground text-pretty max-w-2xl mx-auto">
            Upload an image and let AI replace the background with professional results. Simple, fast, and intuitive.
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert className="mb-6 border-destructive/50 text-destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Success Message Alert */}
        {successMessage && !error && (
          <Alert className="mb-6 border-primary/50 bg-primary/5">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            <AlertDescription className="text-primary">{successMessage}</AlertDescription>
          </Alert>
        )}

        {/* Main Content */}
        <div className="grid gap-8 md:grid-cols-2">
          {/* Upload Section */}
          <Card className="border-2 border-dashed border-border hover:border-primary/50 transition-colors">
            <CardHeader className="text-center pb-4">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Upload className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold text-foreground">Upload Image</h2>
              </div>
              <p className="text-sm text-muted-foreground">Drag & drop or click to select • Max 15MB • Images only</p>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Drop Zone */}
              <div
                ref={dropZoneRef}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`
                  relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all
                  ${
                    dragActive
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50 hover:bg-muted/50"
                  }
                `}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileInput}
                  className="hidden"
                  aria-label="Upload image file"
                />

                <div className="space-y-3">
                  <ImageIcon className="h-12 w-12 text-muted-foreground mx-auto" />
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {dragActive ? "Drop your image here" : "Click to upload or drag & drop"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">PNG, JPG, WEBP up to 15MB</p>
                  </div>
                </div>
              </div>

              {/* File Info */}
              {selectedFile && (
                <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground truncate">{selectedFile.name}</span>
                    <span className="text-xs text-muted-foreground">{formatFileSize(selectedFile.size)}</span>
                  </div>
                  {imageDimensions && (
                    <p className="text-xs text-muted-foreground">
                      {imageDimensions.width} × {imageDimensions.height} pixels
                    </p>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3">
                <Button
                  onClick={onSubmit}
                  disabled={!selectedFile || isLoading}
                  className="flex-1 bg-accent hover:bg-accent/90 text-accent-foreground"
                  aria-busy={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <ImageIcon className="h-4 w-4 mr-2" />
                      Replace Background
                    </>
                  )}
                </Button>

                <Button onClick={reset} variant="outline" disabled={isLoading} className="px-4 bg-transparent">
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>

              {/* Generate Multi Views Button */}
              {resultUrl && !multiViewResults && !isLoadingMulti && (
                <Button
                  onClick={generateMultiViews}
                  disabled={isLoadingMulti}
                  className="w-full bg-primary hover:bg-primary/90"
                  variant="default"
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate Multi Views
                </Button>
              )}

              {/* Loading State for Multi-View Generation */}
              {isLoadingMulti && (
                <Button disabled className="w-full bg-primary" variant="default">
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating 4 Views...
                </Button>
              )}

              {!selectedFile && (
                <p className="text-xs text-muted-foreground text-center">Select an image to get started</p>
              )}
            </CardContent>
          </Card>

          {/* Results Section */}
          <Card>
            <CardHeader className="text-center pb-4">
              <div className="flex items-center justify-center gap-2 mb-2">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold text-foreground">Results</h2>
              </div>
              <p className="text-sm text-muted-foreground">Your processed image will appear here</p>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Image Comparison */}
              <div className="space-y-4">
                {previewUrl && (
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground mb-2 block">Original</Label>
                    <div className="relative rounded-lg overflow-hidden bg-muted/30">
                      <img
                        src={previewUrl || "/placeholder.svg"}
                        alt="Original image"
                        className="w-full h-auto max-h-64 object-contain"
                      />
                    </div>
                  </div>
                )}

                {previewUrl && <Separator />}

                {isLoading ? (
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground mb-2 block">Processed</Label>
                    <Skeleton className="w-full h-64 rounded-lg" />
                    <p className="text-sm text-muted-foreground text-center mt-2">Processing your image...</p>
                  </div>
                ) : resultUrl ? (
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground mb-2 block">Processed</Label>
                    <div className="relative rounded-lg overflow-hidden bg-muted/30">
                      <img
                        src={resultUrl || "/placeholder.svg"}
                        alt="Processed image with background replaced"
                        className="w-full h-auto max-h-64 object-contain"
                      />
                    </div>
                    {processingTime && (
                      <p className="text-xs text-muted-foreground text-center mt-2">Processed in {processingTime}ms</p>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <ImageIcon className="h-16 w-16 text-muted-foreground/50 mx-auto mb-4" />
                    <p className="text-sm text-muted-foreground">Upload and process an image to see results</p>
                  </div>
                )}
              </div>

              {/* Download Button */}
              {resultUrl && !multiViewResults && (
                <Button onClick={downloadResult} className="w-full bg-transparent" variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  Download Result
                </Button>
              )}

              {multiViewResults && (
                <div className="space-y-4">
                  <Separator />
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground mb-3 block">Multi-View Results</Label>
                    <Carousel className="w-full">
                      <CarouselContent>
                        <CarouselItem>
                          <div className="space-y-2">
                            <div className="relative rounded-lg overflow-hidden bg-muted/30">
                              <img
                                src={multiViewResults.front || "/placeholder.svg"}
                                alt="Front view"
                                className="w-full h-auto max-h-64 object-contain"
                              />
                            </div>
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-medium text-muted-foreground">Front View</p>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => downloadMultiView(multiViewResults.front, "front")}
                              >
                                <Download className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </CarouselItem>
                        <CarouselItem>
                          <div className="space-y-2">
                            <div className="relative rounded-lg overflow-hidden bg-muted/30">
                              <img
                                src={multiViewResults.left || "/placeholder.svg"}
                                alt="Left view"
                                className="w-full h-auto max-h-64 object-contain"
                              />
                            </div>
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-medium text-muted-foreground">Left View</p>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => downloadMultiView(multiViewResults.left, "left")}
                              >
                                <Download className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </CarouselItem>
                        <CarouselItem>
                          <div className="space-y-2">
                            <div className="relative rounded-lg overflow-hidden bg-muted/30">
                              <img
                                src={multiViewResults.right || "/placeholder.svg"}
                                alt="Right view"
                                className="w-full h-auto max-h-64 object-contain"
                              />
                            </div>
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-medium text-muted-foreground">Right View</p>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => downloadMultiView(multiViewResults.right, "right")}
                              >
                                <Download className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </CarouselItem>
                        <CarouselItem>
                          <div className="space-y-2">
                            <div className="relative rounded-lg overflow-hidden bg-muted/30">
                              <img
                                src={multiViewResults.back || "/placeholder.svg"}
                                alt="Back view"
                                className="w-full h-auto max-h-64 object-contain"
                              />
                            </div>
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-medium text-muted-foreground">Back View</p>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => downloadMultiView(multiViewResults.back, "back")}
                              >
                                <Download className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </CarouselItem>
                      </CarouselContent>
                      <CarouselPrevious />
                      <CarouselNext />
                    </Carousel>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
