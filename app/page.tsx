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
import {
  Upload,
  Download,
  RotateCcw,
  ImageIcon,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  AlertTriangle,
} from "lucide-react"

interface ImageDimensions {
  width: number
  height: number
}

interface MultiViewBinaryData {
  data?: string
  mimeType?: string
  [key: string]: unknown
}

type MultiViewPayload = string | MultiViewBinaryData | null | undefined

interface MultiViewResponseObject {
  success?: boolean
  mode?: string
  front_b64?: MultiViewPayload
  left_b64?: MultiViewPayload
  right_b64?: MultiViewPayload
  back_b64?: MultiViewPayload
  front?: MultiViewPayload
  left?: MultiViewPayload
  right?: MultiViewPayload
  back?: MultiViewPayload
  binary?: Record<string, MultiViewPayload>
  error?: unknown
}

interface MultiViewResponseItem {
  json?: MultiViewResponseObject | Record<string, unknown>
  binary?: Record<string, MultiViewPayload>
  success?: boolean
  error?: unknown
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
  const [warningMessage, setWarningMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [processingTime, setProcessingTime] = useState<number | null>(null)
  const [imageDimensions, setImageDimensions] = useState<ImageDimensions | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [multiViewStartTime, setMultiViewStartTime] = useState<number | null>(null)
  const [elapsedTime, setElapsedTime] = useState<number>(0)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropZoneRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      if (resultUrl) URL.revokeObjectURL(resultUrl)
    }
  }, [])

  // Timer for multi-view generation
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
        setWarningMessage(null)
        return
      }

      setError(null)
      setWarningMessage(null)
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
    setWarningMessage(null)
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
    setWarningMessage(null)
    setSuccessMessage(null)
    setMultiViewStartTime(Date.now())

    try {
      const formData = new FormData()
      formData.append("edited", resultBlob, "edited.jpg")

      console.log("=== STARTING MULTI-VIEW REQUEST ===")
      console.log("Webhook URL:", webhookUrl)
      console.log("File size:", resultBlob.size, "bytes")
      console.log("File type:", resultBlob.type)

      // Create an AbortController with a longer timeout for multi-view generation
      const controller = new AbortController()
      const timeoutId = setTimeout(() => {
        console.error("Request timed out after 3 minutes")
        controller.abort()
      }, 180000) // 3 minutes timeout

      console.log("Sending fetch request...")
      const fetchStartTime = Date.now()
      
      const response = await fetch(webhookUrl, {
        method: "POST",
        body: formData,
        signal: controller.signal,
      })

      const fetchDuration = Date.now() - fetchStartTime
      console.log(`Fetch completed in ${fetchDuration}ms`)

      clearTimeout(timeoutId)

      console.log("Response status:", response.status, response.statusText)
      console.log("Response headers:", Object.fromEntries(response.headers.entries()))

      if (!response.ok) {
        let errorMessage = `Server error: ${response.status} ${response.statusText}`
        try {
          const errorText = await response.text()
          console.error("Error response body:", errorText)
          if (errorText) errorMessage += ` - ${errorText}`
        } catch (e) {
          console.error("Could not read error response:", e)
        }
        throw new Error(errorMessage)
      }

      const contentType = response.headers.get("content-type")
      console.log("Content-Type:", contentType)

      let data: unknown
      try {
        const responseText = await response.text()
        console.log("Raw response (first 500 chars):", responseText.substring(0, 500))
        data = JSON.parse(responseText)
        console.log("Parsed JSON response:", JSON.stringify(data, null, 2))
      } catch (e) {
        console.error("Failed to parse response as JSON:", e)
        throw new Error("Server returned invalid JSON response")
      }

      const getDataUrl = (payload: MultiViewPayload): string => {
        if (!payload) return ""

        if (typeof payload === "string") {
          const trimmed = payload.trim()
          if (!trimmed) return ""
          if (trimmed.startsWith("data:")) return trimmed
          return `data:image/jpeg;base64,${trimmed}`
        }

        const base64 = typeof payload.data === "string" ? payload.data.trim() : ""
        if (!base64) return ""
        if (base64.startsWith("data:")) return base64
        const mime = typeof payload.mimeType === "string" && payload.mimeType ? payload.mimeType : "image/jpeg"
        return `data:${mime};base64,${base64}`
      }

      const isRecord = (value: unknown): value is Record<string, unknown> =>
        typeof value === "object" && value !== null && !Array.isArray(value)

      type ViewKey = "front" | "left" | "right" | "back"
      const viewKeys: ViewKey[] = ["front", "left", "right", "back"]
      const viewAlias: Record<ViewKey, string[]> = {
        front: ["front_b64", "front"],
        left: ["left_b64", "left"],
        right: ["right_b64", "right"],
        back: ["back_b64", "back"],
      }

      const collectedPayloads: Partial<Record<ViewKey, MultiViewPayload>> = {}

      const collectFromObject = (obj: MultiViewResponseObject | Record<string, unknown>) => {
        const record = obj as Record<string, unknown>
        for (const key of viewKeys) {
          // First check direct properties (from Code node response)
          for (const alias of viewAlias[key]) {
            if (collectedPayloads[key] !== undefined) break
            const value = record[alias]
            if (value !== undefined && value !== null) {
              // Skip invalid data URLs (like "data:image/png;base64,filesystem-v2")
              if (typeof value === 'string' && value.includes('filesystem-v2')) {
                console.log(`Skipping invalid ${key} data: ${value}`)
                continue
              }
              console.log(`Found ${key} in direct properties:`, typeof value)
              collectedPayloads[key] = value as MultiViewPayload
            }
          }

          if (collectedPayloads[key] !== undefined) continue

          const binary = (obj as MultiViewResponseObject).binary
          if (binary && typeof binary === "object") {
            const binaryRecord = binary as Record<string, MultiViewPayload>
            const value = binaryRecord[key]
            if (value !== undefined) {
              console.log(`Found ${key} in binary:`, value)
              collectedPayloads[key] = value
            }
          }
        }
      }

      let successFlag: boolean | undefined

      if (Array.isArray(data)) {
        console.log(`Processing ${data.length} items from array response`)
        for (const item of data) {
          if (!isRecord(item)) {
            console.log("Skipping non-record item:", item)
            continue
          }

          const typedItem = item as MultiViewResponseItem
          console.log("Processing item:", Object.keys(item))

          if (typeof typedItem.success === "boolean") {
            successFlag = typedItem.success
          }

          if (typedItem.error !== undefined && typedItem.error !== null) {
            const message =
              typeof typedItem.error === "string" ? typedItem.error : "Failed to generate multi-view images"
            throw new Error(message)
          }

          // First check if the views are directly on the item (n8n Code node format)
          for (const key of viewKeys) {
            if (collectedPayloads[key] !== undefined) continue
            const value = (item as any)[key]
            if (value && typeof value === 'string' && value.startsWith('data:image/')) {
              console.log(`Found ${key} directly on item`)
              collectedPayloads[key] = value
            }
          }

          const json = (typedItem.json ?? null) as MultiViewResponseObject | Record<string, unknown> | null
          if (json && isRecord(json)) {
            const jsonObject = json as MultiViewResponseObject
            if (typeof jsonObject.success === "boolean") {
              successFlag = jsonObject.success
            }

            if (jsonObject.error !== undefined && jsonObject.error !== null) {
              const message =
                typeof jsonObject.error === "string" ? jsonObject.error : "Failed to generate multi-view images"
              throw new Error(message)
            }

            // Check if json has a 'views' object (new format)
            if ('views' in jsonObject && isRecord(jsonObject.views)) {
              const views = jsonObject.views as Record<string, MultiViewPayload>
              console.log("Found views object in json:", Object.keys(views))
              for (const key of viewKeys) {
                if (views[key] !== undefined) {
                  console.log(`Collecting ${key} from json.views`)
                  collectedPayloads[key] = views[key]
                }
              }
            } else {
              collectFromObject(jsonObject)
            }
          }

          const binary = typedItem.binary
          if (binary && typeof binary === "object") {
            console.log("Binary keys found:", Object.keys(binary))
            const binaryRecord = binary as Record<string, MultiViewPayload>
            for (const key of viewKeys) {
              if (collectedPayloads[key] !== undefined) continue
              const value = binaryRecord[key]
              if (value !== undefined) {
                console.log(`Collecting ${key} from item binary`)
                collectedPayloads[key] = value
              }
            }
          }
        }
      } else if (isRecord(data)) {
        console.log("Processing single object response")
        const responseObject = data as MultiViewResponseObject

        if (typeof responseObject.success === "boolean") {
          successFlag = responseObject.success
        }

        if (responseObject.error !== undefined && responseObject.error !== null) {
          const message =
            typeof responseObject.error === "string" ? responseObject.error : "Failed to generate multi-view images"
          throw new Error(message)
        }

        // Check if response has a 'views' object (new format)
        if (isRecord(responseObject) && 'views' in responseObject) {
          const views = responseObject.views as Record<string, MultiViewPayload>
          console.log("Found views object:", Object.keys(views))
          for (const key of viewKeys) {
            if (views[key] !== undefined) {
              console.log(`Collecting ${key} from views object`)
              collectedPayloads[key] = views[key]
            }
          }
        } else {
          collectFromObject(responseObject)
        }
      }

      if (successFlag === false) {
        throw new Error("Failed to generate multi-view images")
      }

      console.log("Collected payloads:", Object.keys(collectedPayloads))
      console.log("Payload details:", collectedPayloads)

      const views = {
        front: getDataUrl(collectedPayloads.front),
        left: getDataUrl(collectedPayloads.left),
        right: getDataUrl(collectedPayloads.right),
        back: getDataUrl(collectedPayloads.back),
      }

      console.log("Generated views:", Object.entries(views).map(([k, v]) => `${k}: ${v ? 'YES' : 'NO'}`))

      const generatedViews = Object.values(views).filter(Boolean).length

      if (generatedViews === 0) {
        console.error("No views generated. Collected payloads were:", collectedPayloads)
        throw new Error("No multi-view images were returned by the server")
      }

      const missingViews = Object.entries(views)
        .filter(([_, url]) => !url)
        .map(([view]) => view)

      setWarningMessage(
        missingViews.length > 0
          ? `Some views were not generated: ${missingViews.join(", ")}`
          : null,
      )

      setMultiViewResults(views)
      setSuccessMessage(
        generatedViews === 4
          ? "Successfully generated 4 views"
          : `Generated ${generatedViews} of 4 views`,
      )
    } catch (err) {
      setWarningMessage(null)
      console.error("Multi-view generation error:", err)
      console.error("Error type:", err instanceof Error ? err.constructor.name : typeof err)
      console.error("Error details:", err)
      
      if (err instanceof Error) {
        if (err.name === "AbortError") {
          setError("Request timed out. Multi-view generation takes up to 3 minutes. Please try again with a smaller image or check your internet connection.")
        } else if (err.name === "TypeError" && err.message.includes("fetch")) {
          setError("Network error: Could not connect to n8n server. Please check your internet connection and ensure the n8n webhook URL is correct.")
        } else {
          setError(`Error: ${err.message}`)
        }
      } else {
        setError("An unexpected error occurred")
      }
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
    setWarningMessage(null)
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

        {warningMessage && !error && (
          <Alert className="mb-6 border-yellow-500/50 bg-yellow-500/10 text-yellow-700">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{warningMessage}</AlertDescription>
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
                <div className="space-y-2">
                  <Button disabled className="w-full bg-primary" variant="default">
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating 4 Views... {elapsedTime > 0 && `(${elapsedTime}s)`}
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    This may take 1-3 minutes. Please wait while we process 4 AI views...
                    {elapsedTime > 60 && " Almost there!"}
                  </p>
                </div>
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
