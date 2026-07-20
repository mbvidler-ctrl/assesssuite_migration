import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  FileText, 
  Download, 
  Trash2, 
  Upload, 
  Loader2,
  ExternalLink,
  File,
  Image as ImageIcon
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { uploadTenantFile } from '@/lib/fileIntegrations';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ClientDataExtractor from '../documents/ClientDataExtractor';
import { SecureFileLink } from '@/components/files/SecureFile';

const documentTypeLabels = {
  referral: 'Referral',
  report: 'Report',
  assessment: 'Assessment',
  consent: 'Consent Form',
  medical_record: 'Medical Record',
  other: 'Other'
};

const documentTypeColors = {
  referral: 'bg-blue-100 text-blue-800',
  report: 'bg-green-100 text-green-800',
  assessment: 'bg-purple-100 text-purple-800',
  consent: 'bg-yellow-100 text-yellow-800',
  medical_record: 'bg-red-100 text-red-800',
  other: 'bg-slate-100 text-slate-800'
};

export default function ClientDocuments({ clientId, client, allAssessments = [], onDataExtracted }) {
  const [documents, setDocuments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [deleteDoc, setDeleteDoc] = useState(null);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadType, setUploadType] = useState('other');
  const [showExtractor, setShowExtractor] = useState(false);

  useEffect(() => {
    loadDocuments();
  }, [clientId]);

  const loadDocuments = async () => {
    setIsLoading(true);
    try {
      const docs = await base44.entities.ClientDocument.filter({ client_id: clientId }, '-created_date');
      setDocuments(docs);
    } catch (error) {
      console.error('Error loading documents:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpload = async () => {
    if (!uploadFile) {
      toast.error('Please select a file');
      return;
    }
    setIsUploading(true);
    try {
      // Get fresh client data to ensure we have org_id
      const clientData = await base44.entities.Client.filter({ id: clientId });
      if (!clientData || clientData.length === 0) {
        throw new Error('Client not found');
      }
      
      const clientRecord = clientData[0];
      if (!clientRecord.org_id) {
        throw new Error('Client is missing organization ID. Please contact support.');
      }
      
      const { file_url } = await uploadTenantFile({
        file: uploadFile,
        org_id: clientRecord.org_id,
        purpose: 'clinical-attachment',
      });
      
      await base44.entities.ClientDocument.create({
        org_id: clientRecord.org_id,
        client_id: clientId,
        document_type: uploadType,
        file_url: file_url,
        file_name: uploadFile.name
      });

      toast.success('Document uploaded successfully');
      setShowUploadForm(false);
      setUploadFile(null);
      setUploadType('other');
      loadDocuments();
    } catch (error) {
      console.error('Error uploading document:', error);
      toast.error(`Failed to upload: ${error.message || 'Unknown error'}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteDoc) return;
    try {
      await base44.entities.ClientDocument.delete(deleteDoc.id);
      toast.success('Document deleted');
      setDeleteDoc(null);
      loadDocuments();
    } catch (error) {
      console.error('Error deleting document:', error);
      toast.error('Failed to delete document');
    }
  };

  const getFileIcon = (fileName) => {
    const ext = fileName?.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
      return <ImageIcon className="w-4 h-4" />;
    }
    return <File className="w-4 h-4" />;
  };

  const documentUrls = documents.map(doc => doc.file_url);

  return (
    <>
      <AlertDialog open={!!deleteDoc} onOpenChange={(open) => !open && setDeleteDoc(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteDoc?.file_name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              Documents
            </CardTitle>
            <div className="flex items-center gap-2">
              {documents.length > 0 && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setShowExtractor(!showExtractor)}
                  className="border-blue-300 hover:bg-blue-50"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Scan for Data
                </Button>
              )}
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowUploadForm(!showUploadForm)}
              >
                <Upload className="w-4 h-4 mr-2" />
                Upload
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {showExtractor && documents.length > 0 && (
            <ClientDataExtractor
              fileUrls={documentUrls}
              client={client}
              allAssessments={allAssessments}
              onExtracted={() => {
                setShowExtractor(false);
                if (onDataExtracted) onDataExtracted();
              }}
            />
          )}

          {showUploadForm && (
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200 space-y-3">
              <div>
                <Label>Document Type</Label>
                <Select value={uploadType} onValueChange={setUploadType}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(documentTypeLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>File</Label>
                <Input
                  type="file"
                  onChange={(e) => setUploadFile(e.target.files[0])}
                  className="mt-1"
                  accept=".pdf,.png,.jpg,.jpeg,.docx"
                />
              </div>
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  onClick={handleUpload}
                  disabled={isUploading || !uploadFile}
                >
                  {isUploading ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Uploading...</>
                  ) : (
                    'Upload'
                  )}
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => {
                    setShowUploadForm(false);
                    setUploadFile(null);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            </div>
          ) : documents.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-4">No documents uploaded</p>
          ) : (
            <div className="space-y-2">
              {documents.map((doc) => (
                <div 
                  key={doc.id}
                  className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {getFileIcon(doc.file_name)}
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm text-slate-900 truncate">{doc.file_name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge className={documentTypeColors[doc.document_type] || documentTypeColors.other}>
                          {documentTypeLabels[doc.document_type] || doc.document_type}
                        </Badge>
                        <span className="text-xs text-slate-500">
                          {doc.created_date && format(new Date(doc.created_date), 'MMM d, yyyy')}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 ml-2">
                    <Button 
                      asChild
                      variant="ghost" 
                      size="icon"
                      className="h-8 w-8"
                    >
                      <SecureFileLink
                        href={doc.file_url}
                        orgId={client?.org_id || doc.org_id}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Open ${doc.file_name || 'document'}`}
                      >
                        <ExternalLink className="w-4 h-4" />
                      </SecureFileLink>
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => setDeleteDoc(doc)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
