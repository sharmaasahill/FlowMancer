'use client';

import { useState } from 'react';
import { Mail, FileText, Users, Loader2 } from 'lucide-react';
import { useCasesApi } from '@/lib/api';
import type { LeadInput, EmailInput, DocumentInput } from '@/types';

export default function UseCaseDemo() {
  const [activeTab, setActiveTab] = useState<'lead' | 'email' | 'document'>('lead');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  // Lead Qualification Form
  const handleLeadQualification = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    const formData = new FormData(e.currentTarget);
    const leadData: LeadInput = {
      name: formData.get('name') as string,
      email: formData.get('email') as string,
      company: formData.get('company') as string,
      phone: formData.get('phone') as string,
      message: formData.get('message') as string,
      source: 'website',
    };

    try {
      const response = await useCasesApi.qualifyLead(leadData);
      const apiData = response.data;
      
      // Extract only the data we need for display
      setResult({
        status: apiData.result?.status || apiData.status || 'completed',
        assessment: apiData.result?.assessment || apiData.assessment || '',
        ai_model: apiData.result?.ai_model || apiData.ai_model || '',
        error: apiData.result?.error || apiData.error || '',
        message: 'Lead qualified successfully'
      });
    } catch (error) {
      console.error('Error:', error);
      setResult({ status: 'error', message: 'Failed to process lead', error: String(error) });
    } finally {
      setLoading(false);
    }
  };

  // Email Processing Form
  const handleEmailProcessing = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    const formData = new FormData(e.currentTarget);
    const emailData: EmailInput = {
      from_email: formData.get('from_email') as string,
      subject: formData.get('subject') as string,
      body: formData.get('body') as string,
    };

    try {
      const response = await useCasesApi.processEmail(emailData);
      const apiData = response.data;
      
      // Extract only the data we need for display
      setResult({
        status: apiData.result?.status || apiData.status || 'completed',
        result: apiData.result?.result || apiData.result || '',
        ai_model: apiData.result?.ai_model || apiData.ai_model || '',
        error: apiData.result?.error || apiData.error || '',
        message: 'Email processed successfully'
      });
    } catch (error) {
      console.error('Error:', error);
      setResult({ status: 'error', message: 'Failed to process email', error: String(error) });
    } finally {
      setLoading(false);
    }
  };

  // Document Processing Form
  const handleDocumentProcessing = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    const formData = new FormData(e.currentTarget);
    const documentData: DocumentInput = {
      document_type: formData.get('document_type') as string,
      file_content: formData.get('file_content') as string,
    };

    try {
      const response = await useCasesApi.processDocument(documentData);
      const apiData = response.data;
      
      // Extract only the data we need for display
      setResult({
        status: apiData.result?.status || apiData.status || 'completed',
        result: apiData.result?.result || apiData.result || '',
        ai_model: apiData.result?.ai_model || apiData.ai_model || '',
        error: apiData.result?.error || apiData.error || '',
        message: 'Document processed successfully'
      });
    } catch (error) {
      console.error('Error:', error);
      setResult({ status: 'error', message: 'Failed to process document', error: String(error) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Use Case Demos</h1>
        <p className="text-gray-600 mt-1">Try out FlowMancer's AI-powered automation</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b">
        <button
          onClick={() => setActiveTab('lead')}
          className={`flex items-center gap-2 px-6 py-3 font-semibold border-b-2 transition ${
            activeTab === 'lead'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          <Users className="w-5 h-5" />
          Lead Qualification
        </button>
        <button
          onClick={() => setActiveTab('email')}
          className={`flex items-center gap-2 px-6 py-3 font-semibold border-b-2 transition ${
            activeTab === 'email'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          <Mail className="w-5 h-5" />
          Email Processing
        </button>
        <button
          onClick={() => setActiveTab('document')}
          className={`flex items-center gap-2 px-6 py-3 font-semibold border-b-2 transition ${
            activeTab === 'document'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          <FileText className="w-5 h-5" />
          Document Processing
        </button>
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold mb-4">Input Data</h2>
          
          {activeTab === 'lead' && (
            <form onSubmit={handleLeadQualification} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  name="name"
                  required
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="John Doe"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  name="email"
                  required
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="john@company.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
                <input
                  type="text"
                  name="company"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Acme Corp"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="tel"
                  name="phone"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="+1 234 567 8900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                <textarea
                  name="message"
                  rows={3}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Interested in enterprise plan..."
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Qualify Lead'
                )}
              </button>
            </form>
          )}

          {activeTab === 'email' && (
            <form onSubmit={handleEmailProcessing} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">From Email</label>
                <input
                  type="email"
                  name="from_email"
                  required
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="customer@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                <input
                  type="text"
                  name="subject"
                  required
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Need help with product"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Body</label>
                <textarea
                  name="body"
                  required
                  rows={6}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Hello, I'm having issues with..."
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Process Email'
                )}
              </button>
            </form>
          )}

          {activeTab === 'document' && (
            <form onSubmit={handleDocumentProcessing} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Document Type</label>
                <select
                  name="document_type"
                  required
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="invoice">Invoice</option>
                  <option value="contract">Contract</option>
                  <option value="receipt">Receipt</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Document Content</label>
                <textarea
                  name="file_content"
                  required
                  rows={8}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Paste document text here..."
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Process Document'
                )}
              </button>
            </form>
          )}
        </div>

        {/* Results */}
        <div className="bg-white rounded-lg shadow-md p-6 max-h-[600px] overflow-y-auto">
          <h2 className="text-xl font-bold mb-4">AI Analysis Result</h2>
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : result ? (
            <div className="space-y-4">
              {/* Status Badge */}
              <div
                className={`p-4 rounded-lg ${
                  result.status === 'completed' || result.status === 'success'
                    ? 'bg-green-50 border border-green-200'
                    : 'bg-red-50 border border-red-200'
                }`}
              >
                <p className="font-semibold">
                  Status: {result.status === 'completed' || result.status === 'success' ? '✅ Success' : '❌ Error'}
                </p>
                {result.message && <p className="text-sm mt-1">{result.message}</p>}
              </div>

              {/* AI Assessment - Formatted */}
              {result.assessment && (
                <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                  <h3 className="font-bold text-blue-900 mb-3">🤖 AI Analysis</h3>
                  <div className="prose prose-sm max-w-none text-gray-800 whitespace-pre-line">
                    {typeof result.assessment === 'string' ? result.assessment : JSON.stringify(result.assessment, null, 2)}
                  </div>
                </div>
              )}

              {/* Email/Document Result */}
              {result.result && !result.assessment && (
                <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                  <h3 className="font-bold text-blue-900 mb-3">🤖 AI Analysis</h3>
                  <div className="prose prose-sm max-w-none text-gray-800 whitespace-pre-line">
                    {typeof result.result === 'string' ? result.result : JSON.stringify(result.result, null, 2)}
                  </div>
                </div>
              )}

              {/* AI Model Info */}
              {result.ai_model && (
                <div className="text-xs text-gray-500 text-center pt-2 border-t">
                  Powered by {result.ai_model}
                </div>
              )}

              {/* Error Details */}
              {result.error && (
                <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
                  <h3 className="font-bold text-red-900 mb-2">Error Details</h3>
                  <p className="text-sm text-red-700">{result.error}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-500">
              <p>Submit the form to see AI-powered results</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

