import React from 'react';
import moment from 'moment';
import { SecureFileImage } from '@/components/files/SecureFile';

const PrintableSOAPNote = React.forwardRef(({ soapNote, client, appointment, clinician }, ref) => {
    if (!soapNote || !client || !appointment || !clinician) {
        return null;
    }

    const sectionStyle = {
        marginBottom: '1.5rem',
        paddingBottom: '1rem',
        borderBottom: '1px solid #e5e7eb',
    };
    
    const labelStyle = {
        fontWeight: 'bold',
        fontSize: '1.1rem',
        color: '#1f2937',
        marginBottom: '0.5rem',
        pageBreakAfter: 'avoid'
    };

    const contentStyle = {
        whiteSpace: 'pre-wrap',
        fontSize: '1rem',
        color: '#374151',
        pageBreakInside: 'avoid',
    };
    
    return (
        <div ref={ref} className="printable-soap-note">
            <style>{`
                @media print {
                    @page { 
                        size: A4 portrait; 
                        margin: 20mm 18mm 20mm 18mm; 
                    }
                    body { 
                        -webkit-print-color-adjust: exact; 
                        print-color-adjust: exact;
                        font-size: 10.5pt;
                        line-height: 1.25; 
                    }
                    .printable-soap-note { 
                        font-family: Arial, sans-serif; 
                        font-size: 10.5pt; 
                        line-height: 1.25; 
                        color: black; 
                    }
                    .print-header { 
                        display: block; 
                        margin-bottom: 1.5em; 
                        padding-bottom: 1em; 
                        border-bottom: 2px solid #000;
                        break-inside: avoid;
                        page-break-inside: avoid;
                    }
                    .clinic-details { 
                        text-align: right; 
                        font-size: 9pt; 
                    }
                    .report-title { 
                        text-align: center; 
                        font-size: 14pt; 
                        font-weight: bold; 
                        margin: 1em 0;
                        break-after: avoid;
                        page-break-after: avoid; 
                    }
                    .soap-section {
                        break-inside: avoid;
                        page-break-inside: avoid;
                        margin-bottom: 8pt;
                    }
                    h2 {
                        break-after: avoid;
                        page-break-after: avoid;
                    }
                }
            `}</style>

            <div className="print-header">
                {clinician.clinic_logo_url ? (
                    <SecureFileImage src={clinician.clinic_logo_url} orgId={client.org_id} alt="Clinic Logo" style={{maxWidth: '150px', maxHeight: '75px'}} />
                ) : (
                    <h2>{clinician.clinic_name}</h2>
                )}
                <div className="clinic-details">
                    <strong>{clinician.clinic_name}</strong><br/>
                    {clinician.clinic_address}<br/>
                    Phone: {clinician.clinic_phone}<br/>
                    Email: {clinician.clinic_email}
                </div>
            </div>

            <h1 className="report-title">SOAP Note</h1>
            
            <div style={{...sectionStyle, borderTop: '1px solid #e5e7eb', paddingTop: '1rem'}}>
                <p><strong>Client:</strong> {client.full_name}</p>
                <p><strong>Date of Birth:</strong> {moment(client.date_of_birth).format('DD/MM/YYYY')}</p>
                <p><strong>Session Date:</strong> {moment(soapNote.note_date).format('dddd, MMMM Do YYYY, h:mm A')}</p>
                {soapNote.session_location && <p><strong>Location:</strong> {soapNote.session_location}</p>}
                <p><strong>Clinician:</strong> {clinician.full_name}</p>
            </div>
            
            <div className="soap-section" style={sectionStyle}>
                <h2 style={labelStyle}>Subjective</h2>
                <p style={contentStyle}>{soapNote.subjective || 'N/A'}</p>
            </div>
            
            <div className="soap-section" style={sectionStyle}>
                <h2 style={labelStyle}>Objective</h2>
                <p style={contentStyle}>{soapNote.objective || 'N/A'}</p>
            </div>

            <div className="soap-section" style={sectionStyle}>
                <h2 style={labelStyle}>Assessment</h2>
                <p style={contentStyle}>{soapNote.assessment || 'N/A'}</p>
            </div>

            <div className="soap-section" style={sectionStyle}>
                <h2 style={labelStyle}>Plan</h2>
                <p style={contentStyle}>{soapNote.plan || 'N/A'}</p>
            </div>
            
            {soapNote.other && (
                 <div className="soap-section" style={{...sectionStyle, borderBottom: 'none'}}>
                    <h2 style={labelStyle}>Other</h2>
                    <p style={contentStyle}>{soapNote.other}</p>
                </div>
            )}
        </div>
    );
});

export default PrintableSOAPNote;
