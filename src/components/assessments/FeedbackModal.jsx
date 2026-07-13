import React, { useState } from "react";
import { User } from "@/entities/User";
import { SendEmail } from "@/integrations/Core";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function FeedbackModal({ onClose }) {
  const [requestType, setRequestType] = useState("new_assessment");
  const [assessmentName, setAssessmentName] = useState("");
  const [details, setDetails] = useState("");
  const [isSending, setIsSending] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!details.trim()) {
      toast.error("Please provide some details for your request.");
      return;
    }

    setIsSending(true);
    try {
      const currentUser = await User.me();
      
      // Get user's organization
      const orgMemberships = await base44.entities.OrganizationMember.filter({ user_email: currentUser.email });
      const userOrgId = orgMemberships.length > 0 ? orgMemberships[0].org_id : null;

      if (!userOrgId) {
        toast.error("Unable to submit - no organization found for your account.");
        setIsSending(false);
        return;
      }
      
      // Create the assessment request in the database
      await base44.entities.AssessmentRequest.create({
        org_id: userOrgId,
        request_type: requestType,
        assessment_name: assessmentName,
        details: details,
        user_email: currentUser.email,
        user_name: currentUser.full_name,
        status: "pending"
      });

      // Try to send notification emails (but don't fail if emails can't be sent)
      try {
        const adminSubject = `New Assessment Request: ${requestType === 'new_assessment' ? assessmentName || 'New Assessment' : 'Error Report'}`;
        const adminBody = `
          <h2>New Assessment Request Submitted</h2>
          <hr>
          <p><strong>Request Type:</strong> ${requestType === 'new_assessment' ? 'New Assessment Request' : 'Error Report'}</p>
          ${assessmentName ? `<p><strong>Assessment Name:</strong> ${assessmentName}</p>` : ''}
          <p><strong>Submitted by:</strong> ${currentUser.full_name} (${currentUser.email})</p>
          <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
          <hr>
          <p><strong>Details:</strong></p>
          <p>${details.replace(/\n/g, '<br>')}</p>
          <hr>
          <p><em>Review this request in the Admin Dashboard → Assessment Requests tab</em></p>
        `;

        await SendEmail({
          // In-app feedback lands at the AssessSuite admin inbox (Brenton's
          // 12 July 2026 confirmation) — the previous recipient was a stale
          // legacy domain (admin@exphysassess.com).
          to: "admin@assesssuite.com",
          subject: adminSubject,
          body: adminBody,
        });

        const userSubject = `Assessment Library Feedback Confirmation: ${requestType === 'new_assessment' ? 'New Assessment Request' : 'Error Report'}`;
        const userBody = `
          <p>Thank you for your feedback! We have received your request and will review it as soon as possible.</p>
          <hr>
          <h3>Your Request Details</h3>
          <ul>
            <li><strong>Request Type:</strong> ${requestType === 'new_assessment' ? 'New Assessment Request' : 'Error Report'}</li>
            ${assessmentName ? `<li><strong>Assessment Name:</strong> ${assessmentName}</li>` : ''}
            <li><strong>Submitted by:</strong> ${currentUser.full_name} (${currentUser.email})</li>
            <li><strong>Date:</strong> ${new Date().toLocaleDateString()}</li>
          </ul>
          <p><strong>Your Message:</strong></p>
          <p>${details.replace(/\n/g, '<br>')}</p>
          <hr>
          <p><em>This is a confirmation email for your records. Your request has been logged and will be reviewed by our team.</em></p>
        `;

        await SendEmail({
          to: currentUser.email,
          subject: userSubject,
          body: userBody,
        });
      } catch (emailError) {
        console.log("Email notification failed (but request was logged):", emailError);
      }

      toast.success("Your request has been submitted successfully and logged for review!");
      onClose();

    } catch (error) {
      console.error("Failed to submit request:", error);
      toast.error(`Failed to submit request: ${error.message || 'Unknown error'}`);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request an Assessment or Report an Issue</DialogTitle>
          <DialogDescription>
            Missing a test or found an error? Let us know and we'll look into it. Your feedback helps improve the platform.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div>
            <Label htmlFor="requestType">What is this about?</Label>
            <Select value={requestType} onValueChange={setRequestType}>
              <SelectTrigger id="requestType" className="mt-1">
                <SelectValue placeholder="Select request type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new_assessment">I'd like to request a new assessment</SelectItem>
                <SelectItem value="error_report">I found an error in an existing assessment</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="assessmentName">Assessment Name (if applicable)</Label>
            <Input
              id="assessmentName"
              value={assessmentName}
              onChange={(e) => setAssessmentName(e.target.value)}
              placeholder={requestType === 'new_assessment' ? "e.g., Senior Fitness Test" : "e.g., Berg Balance Scale"}
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="details">Details *</Label>
            <Textarea
              id="details"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Please provide as much detail as possible, including links to resources if you have them."
              className="mt-1"
              rows={5}
              required
            />
          </div>

          <div className="bg-blue-50 p-3 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Note:</strong> Your request will be logged and reviewed by our team. You'll receive a confirmation email for your records.
            </p>
          </div>
          
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSending}>
              {isSending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                "Send Request"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}