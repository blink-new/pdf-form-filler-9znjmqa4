import React, { useState, useCallback, useMemo } from 'react'
import { Upload, FileText, Download, Check, AlertCircle } from 'lucide-react'
import { Button } from './components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card'
import { Input } from './components/ui/input'
import { Label } from './components/ui/label'
import { Textarea } from './components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './components/ui/select'
import { Checkbox } from './components/ui/checkbox'
import { RadioGroup, RadioGroupItem } from './components/ui/radio-group'
import { Progress } from './components/ui/progress'
import { Alert, AlertDescription } from './components/ui/alert'
import { Separator } from './components/ui/separator'
import { Badge } from './components/ui/badge'
import { Toaster } from './components/ui/toaster'
import { useToast } from './hooks/use-toast'
import { PDFDocument, PDFForm } from 'pdf-lib'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`

interface FormField {
  id: string
  name: string
  type: 'text' | 'textarea' | 'select' | 'checkbox' | 'radio' | 'signature'
  label: string
  value: string | boolean
  options?: string[]
  required?: boolean
  placeholder?: string
}

interface UploadedFile {
  id: string
  name: string
  size: number
  uploadDate: Date
  fields: FormField[]
  pdfBytes: Uint8Array // Store original PDF data
  pdfUrl: string // URL for PDF viewing
}

function App() {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [selectedFile, setSelectedFile] = useState<UploadedFile | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [numPages, setNumPages] = useState<number | null>(null)
  const [pageNumber, setPageNumber] = useState(1)
  const { toast } = useToast()

  // Mock form fields for demonstration
  const mockFormFields = useMemo<FormField[]>(() => [
    {
      id: '1',
      name: 'fullName',
      type: 'text',
      label: 'Full Name',
      value: '',
      required: true,
      placeholder: 'Enter your full name'
    },
    {
      id: '2',
      name: 'email',
      type: 'text',
      label: 'Email Address',
      value: '',
      required: true,
      placeholder: 'Enter your email'
    },
    {
      id: '3',
      name: 'phone',
      type: 'text',
      label: 'Phone Number',
      value: '',
      placeholder: 'Enter your phone number'
    },
    {
      id: '4',
      name: 'address',
      type: 'textarea',
      label: 'Address',
      value: '',
      placeholder: 'Enter your full address'
    },
    {
      id: '5',
      name: 'country',
      type: 'select',
      label: 'Country',
      value: '',
      options: ['United States', 'Canada', 'United Kingdom', 'Australia', 'Germany', 'France', 'Other']
    },
    {
      id: '6',
      name: 'newsletter',
      type: 'checkbox',
      label: 'Subscribe to newsletter',
      value: false
    },
    {
      id: '7',
      name: 'contactMethod',
      type: 'radio',
      label: 'Preferred Contact Method',
      value: '',
      options: ['Email', 'Phone', 'Mail']
    }
  ], [])

  const handleFileUpload = useCallback(async (files: File[]) => {
    const pdfFiles = files.filter(file => file.type === 'application/pdf')
    
    if (pdfFiles.length === 0) {
      toast({
        title: "Error",
        description: "Please upload PDF files only.",
        variant: "destructive",
      })
      return
    }

    setIsProcessing(true)
    setProgress(0)

    for (let i = 0; i < pdfFiles.length; i++) {
      const file = pdfFiles[i]
      
      try {
        // Read the PDF file as bytes
        const arrayBuffer = await file.arrayBuffer()
        const pdfBytes = new Uint8Array(arrayBuffer)
        
        // Create URL for PDF viewing
        const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' })
        const pdfUrl = URL.createObjectURL(pdfBlob)
        
        // Load the PDF to detect form fields
        let detectedFields: FormField[] = []
        try {
          const pdfDoc = await PDFDocument.load(pdfBytes)
          const form = pdfDoc.getForm()
          const formFields = form.getFields()
          
          // Create form field objects from detected PDF fields
          detectedFields = formFields.map((field, index) => {
            const fieldName = field.getName()
            let fieldType: FormField['type'] = 'text'
            
            // Determine field type based on PDF field type
            if (field.constructor.name.includes('Text')) {
              fieldType = 'text'
            } else if (field.constructor.name.includes('CheckBox')) {
              fieldType = 'checkbox'
            } else if (field.constructor.name.includes('RadioGroup')) {
              fieldType = 'radio'
            } else if (field.constructor.name.includes('Dropdown')) {
              fieldType = 'select'
            }
            
            return {
              id: `field_${index}`,
              name: fieldName,
              type: fieldType,
              label: fieldName.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()),
              value: fieldType === 'checkbox' ? false : '',
              required: false,
              placeholder: `Enter ${fieldName}`
            }
          })
        } catch (formError) {
          console.warn('Could not detect form fields:', formError)
        }
        
        // If no form fields detected, use mock fields
        const fieldsToUse = detectedFields.length > 0 ? detectedFields : mockFormFields.map(field => ({ ...field, value: field.type === 'checkbox' ? false : '' }))
        
        // Show info about detected fields
        if (detectedFields.length > 0) {
          console.log(`Detected ${detectedFields.length} form fields in ${file.name}:`, detectedFields.map(f => f.name))
        } else {
          console.log(`No form fields detected in ${file.name}, using mock fields for demonstration`)
        }
        
        // Update progress
        setProgress(((i + 1) / pdfFiles.length) * 100)

        const newFile: UploadedFile = {
          id: Date.now().toString() + i,
          name: file.name,
          size: file.size,
          uploadDate: new Date(),
          fields: fieldsToUse,
          pdfBytes: pdfBytes,
          pdfUrl: pdfUrl
        }

        setUploadedFiles(prev => [...prev, newFile])
        
        if (!selectedFile) {
          setSelectedFile(newFile)
        }
        
      } catch (error) {
        console.error('Error processing PDF:', error)
        toast({
          title: "Error",
          description: `Failed to process ${file.name}. Please ensure it's a valid PDF.`,
          variant: "destructive",
        })
      }
    }

    setIsProcessing(false)
    setProgress(0)
    toast({
      title: "Success",
      description: `Successfully uploaded ${pdfFiles.length} PDF file(s).`,
    })
  }, [mockFormFields, selectedFile, toast])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    
    const files = Array.from(e.dataTransfer.files)
    handleFileUpload(files)
  }, [handleFileUpload])

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length > 0) {
      handleFileUpload(files)
    }
    // Reset the input value so the same file can be uploaded again
    e.target.value = ''
  }, [handleFileUpload])

  const handleFieldChange = (fieldId: string, value: string | boolean) => {
    if (!selectedFile) return

    const updatedFile = {
      ...selectedFile,
      fields: selectedFile.fields.map(field =>
        field.id === fieldId ? { ...field, value } : field
      )
    }

    setSelectedFile(updatedFile)
    setUploadedFiles(prev =>
      prev.map(file => file.id === selectedFile.id ? updatedFile : file)
    )
  }

  const handleDownload = async () => {
    if (!selectedFile) return
    
    try {
      // Load the original PDF
      const pdfDoc = await PDFDocument.load(selectedFile.pdfBytes)
      const form = pdfDoc.getForm()
      
      // Fill the form fields with user data
      selectedFile.fields.forEach(field => {
        try {
          if (field.value) {
            if (field.type === 'checkbox') {
              const checkboxField = form.getCheckBox(field.name)
              if (field.value) {
                checkboxField.check()
              } else {
                checkboxField.uncheck()
              }
            } else if (field.type === 'radio') {
              const radioGroup = form.getRadioGroup(field.name)
              radioGroup.select(field.value as string)
            } else if (field.type === 'select') {
              const dropdown = form.getDropdown(field.name)
              dropdown.select(field.value as string)
            } else {
              // Text fields
              const textField = form.getTextField(field.name)
              textField.setText(field.value as string)
            }
          }
        } catch (fieldError) {
          console.warn(`Could not fill field ${field.name}:`, fieldError)
          // Continue with other fields even if one fails
        }
      })
      
      // Flatten the form to make it non-editable (optional)
      // form.flatten()
      
      // Save the filled PDF
      const filledPdfBytes = await pdfDoc.save()
      
      // Create blob and download
      const blob = new Blob([filledPdfBytes], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `filled-${selectedFile.name.replace('.pdf', '')}-${Date.now()}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      
      toast({
        title: "Success",
        description: "Filled PDF downloaded successfully!",
      })
    } catch (error) {
      console.error('Error filling PDF:', error)
      toast({
        title: "Error",
        description: "Failed to fill and download PDF. Please try again.",
        variant: "destructive",
      })
    }
  }

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages)
    setPageNumber(1)
  }

  const onDocumentLoadError = (error: Error) => {
    console.error('Error loading PDF:', error)
    toast({
      title: "Error",
      description: "Failed to load PDF for preview.",
      variant: "destructive",
    })
  }

  const getCompletionPercentage = () => {
    if (!selectedFile) return 0
    
    const requiredFields = selectedFile.fields.filter(field => field.required)
    const completedFields = requiredFields.filter(field => {
      if (field.type === 'checkbox') return true // Checkboxes are always "complete"
      return field.value && field.value.toString().trim() !== ''
    })
    
    return Math.round((completedFields.length / requiredFields.length) * 100)
  }

  const renderFormField = (field: FormField) => {
    switch (field.type) {
      case 'text':
        return (
          <Input
            value={field.value as string}
            onChange={(e) => handleFieldChange(field.id, e.target.value)}
            placeholder={field.placeholder}
            className="w-full"
          />
        )
      
      case 'textarea':
        return (
          <Textarea
            value={field.value as string}
            onChange={(e) => handleFieldChange(field.id, e.target.value)}
            placeholder={field.placeholder}
            className="w-full min-h-[80px]"
          />
        )
      
      case 'select':
        return (
          <Select value={field.value as string} onValueChange={(value) => handleFieldChange(field.id, value)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select an option" />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )
      
      case 'checkbox':
        return (
          <div className="flex items-center space-x-2">
            <Checkbox
              id={field.id}
              checked={field.value as boolean}
              onCheckedChange={(checked) => handleFieldChange(field.id, checked as boolean)}
            />
            <Label htmlFor={field.id} className="text-sm font-normal">
              {field.label}
            </Label>
          </div>
        )
      
      case 'radio':
        return (
          <RadioGroup
            value={field.value as string}
            onValueChange={(value) => handleFieldChange(field.id, value)}
          >
            {field.options?.map((option) => (
              <div key={option} className="flex items-center space-x-2">
                <RadioGroupItem value={option} id={`${field.id}-${option}`} />
                <Label htmlFor={`${field.id}-${option}`} className="text-sm font-normal">
                  {option}
                </Label>
              </div>
            ))}
          </RadioGroup>
        )
      
      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <FileText className="h-8 w-8 text-blue-600" />
            <h1 className="text-2xl font-semibold text-gray-900">PDF Form Filler</h1>
          </div>
          
          {selectedFile && (
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-600">
                Progress: {getCompletionPercentage()}%
              </div>
              <Button onClick={handleDownload} className="bg-blue-600 hover:bg-blue-700">
                <Download className="h-4 w-4 mr-2" />
                Download Filled PDF
              </Button>
            </div>
          )}
        </div>
      </header>



      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[calc(100vh-200px)]">
          {/* File Management Sidebar */}
          <div className="lg:col-span-1">
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="text-lg">Files</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Upload Area */}
                <div
                  className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                    isDragOver
                      ? 'border-blue-400 bg-blue-50'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-600 mb-2">
                    Drag & drop PDF files here
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => document.getElementById('file-input')?.click()}
                  >
                    Browse Files
                  </Button>
                  <input
                    id="file-input"
                    type="file"
                    multiple
                    accept=".pdf"
                    className="hidden"
                    onChange={handleFileInputChange}
                  />
                </div>

                {/* Processing Progress */}
                {isProcessing && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Processing...</span>
                      <span>{progress}%</span>
                    </div>
                    <Progress value={progress} className="w-full" />
                  </div>
                )}

                <Separator />

                {/* File List */}
                <div className="space-y-2">
                  {uploadedFiles.map((file) => (
                    <div
                      key={file.id}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedFile?.id === file.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => setSelectedFile(file)}
                    >
                      <div className="flex items-center space-x-2">
                        <FileText className="h-4 w-4 text-gray-500" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {file.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {(file.size / 1024 / 1024).toFixed(1)} MB
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content Area */}
          <div className="lg:col-span-2">
            {selectedFile ? (
              <Card className="h-full">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">PDF Preview</CardTitle>
                    <div className="flex items-center space-x-2">
                      {numPages && (
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPageNumber(Math.max(1, pageNumber - 1))}
                            disabled={pageNumber <= 1}
                          >
                            Previous
                          </Button>
                          <span className="text-sm text-gray-600">
                            Page {pageNumber} of {numPages}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPageNumber(Math.min(numPages, pageNumber + 1))}
                            disabled={pageNumber >= numPages}
                          >
                            Next
                          </Button>
                        </div>
                      )}
                      <Badge variant="outline">
                        {getCompletionPercentage()}% Complete
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="h-full overflow-auto">
                  <div className="flex justify-center">
                    <Document
                      file={selectedFile.pdfUrl}
                      onLoadSuccess={onDocumentLoadSuccess}
                      onLoadError={onDocumentLoadError}
                      loading={
                        <div className="flex items-center justify-center h-96">
                          <div className="text-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                            <p className="text-sm text-gray-600">Loading PDF...</p>
                          </div>
                        </div>
                      }
                    >
                      <Page
                        pageNumber={pageNumber}
                        width={Math.min(600, window.innerWidth - 100)}
                        renderTextLayer={false}
                        renderAnnotationLayer={true}
                      />
                    </Document>
                  </div>
                  <div className="mt-4 text-center text-xs text-gray-500">
                    Form fields detected: {selectedFile.fields.length}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="h-full">
                <CardContent className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <Upload className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      Upload a PDF to get started
                    </h3>
                    <p className="text-sm text-gray-600">
                      Drag and drop a PDF file or click browse to select files
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Form Fields Panel */}
          <div className="lg:col-span-1">
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="text-lg">Form Fields</CardTitle>
                {selectedFile && (
                  <Progress value={getCompletionPercentage()} className="w-full" />
                )}
              </CardHeader>
              <CardContent className="space-y-4 overflow-y-auto">
                {selectedFile ? (
                  selectedFile.fields.map((field) => (
                    <div key={field.id} className="space-y-2">
                      {field.type !== 'checkbox' && (
                        <Label htmlFor={field.id} className="text-sm font-medium">
                          {field.label}
                          {field.required && <span className="text-red-500 ml-1">*</span>}
                        </Label>
                      )}
                      {renderFormField(field)}
                    </div>
                  ))
                ) : (
                  <div className="text-center text-gray-500">
                    <p className="text-sm">Select a PDF file to view form fields</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      <Toaster />
    </div>
  )
}

export default App