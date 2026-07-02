import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { base44 } from "@/api/base44Client";
import {
  Search,
  BookOpen,
  TrendingUp,
  AlertTriangle,
  Target,
  Activity,
  Clock,
  Loader2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  RefreshCw,
  FileText
} from "lucide-react";
import { Toaster, toast } from "sonner";
import ClickableReferences from "../components/assessments/ClickableReferences";
import { format } from "date-fns";
import ImportToSOAPModal from "../components/protocols/ImportToSOAPModal";

export default function TreatmentProtocols() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedCondition, setSelectedCondition] = useState(null);
  const [protocolData, setProtocolData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [disclaimerDismissed, setDisclaimerDismissed] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    overview: true,
    assessment: true,
    exercises: true,
    progression: true,
    contraindications: true,
    outcomes: true,
    meta_analysis: true,
    references: false
  });

  const commonConditions = [
    // Musculoskeletal
    { name: "Osteoarthritis", category: "musculoskeletal", icon: "ðŸ¦´" },
    { name: "Rheumatoid Arthritis", category: "musculoskeletal", icon: "ðŸ¦´" },
    { name: "Psoriatic Arthritis", category: "musculoskeletal", icon: "ðŸ¦´" },
    { name: "Ankylosing Spondylitis", category: "musculoskeletal", icon: "ðŸ¦´" },
    { name: "Chronic Low Back Pain", category: "musculoskeletal", icon: "ðŸ¦´" },
    { name: "Thoracic Pain", category: "musculoskeletal", icon: "ðŸ¦´" },
    { name: "Cervical Pain", category: "musculoskeletal", icon: "ðŸ¦´" },
    { name: "Sacroiliac Joint Dysfunction", category: "musculoskeletal", icon: "ðŸ¦´" },
    { name: "Rotator Cuff Injury", category: "musculoskeletal", icon: "ðŸ¦´" },
    { name: "Rotator Cuff Tendinopathy", category: "musculoskeletal", icon: "ðŸ¦´" },
    { name: "Adhesive Capsulitis (Frozen Shoulder)", category: "musculoskeletal", icon: "ðŸ¦´" },
    { name: "Shoulder Impingement", category: "musculoskeletal", icon: "ðŸ¦´" },
    { name: "Lateral Epicondylalgia (Tennis Elbow)", category: "musculoskeletal", icon: "ðŸ¦´" },
    { name: "Medial Epicondylalgia (Golfer's Elbow)", category: "musculoskeletal", icon: "ðŸ¦´" },
    { name: "Carpal Tunnel Syndrome", category: "musculoskeletal", icon: "ðŸ¦´" },
    { name: "De Quervain's Tenosynovitis", category: "musculoskeletal", icon: "ðŸ¦´" },
    { name: "Plantar Fasciitis", category: "musculoskeletal", icon: "ðŸ¦´" },
    { name: "Achilles Tendinopathy", category: "musculoskeletal", icon: "ðŸ¦´" },
    { name: "Hip Labral Tear", category: "musculoskeletal", icon: "ðŸ¦´" },
    { name: "Knee Meniscus Tear", category: "musculoskeletal", icon: "ðŸ¦´" },
    { name: "Post-Operative Knee Meniscectomy (Arthroscopic)", category: "musculoskeletal", icon: "ðŸ¦´" },
    { name: "Patellofemoral Pain Syndrome", category: "musculoskeletal", icon: "ðŸ¦´" },
    { name: "Chondromalacia Patellae", category: "musculoskeletal", icon: "ðŸ¦´" },
    { name: "Tibial Stress Syndrome (Shin Splints)", category: "musculoskeletal", icon: "ðŸ¦´" },
    { name: "Stress Fractures", category: "musculoskeletal", icon: "ðŸ¦´" },
    { name: "Osteoporosis", category: "musculoskeletal", icon: "ðŸ¦´" },
    { name: "Osteopenia", category: "musculoskeletal", icon: "ðŸ¦´" },
    { name: "Scoliosis", category: "musculoskeletal", icon: "ðŸ¦´" },
    { name: "Kyphosis", category: "musculoskeletal", icon: "ðŸ¦´" },
    { name: "Chronic Pain Syndrome", category: "musculoskeletal", icon: "ðŸ¦´" },
    { name: "Fibromyalgia", category: "musculoskeletal", icon: "ðŸ¦´" },
    { name: "Hypermobility Spectrum Disorder", category: "musculoskeletal", icon: "ðŸ¦´" },
    { name: "Ehlers-Danlos Syndrome (Hypermobile Type)", category: "musculoskeletal", icon: "ðŸ¦´" },
    { name: "Post-Operative THR", category: "musculoskeletal", icon: "ðŸ¦´" },
    { name: "Post-Operative TKR", category: "musculoskeletal", icon: "ðŸ¦´" },
    { name: "Post-Operative ACL Reconstruction", category: "musculoskeletal", icon: "ðŸ¦´" },
    { name: "Post-Operative Rotator Cuff Repair", category: "musculoskeletal", icon: "ðŸ¦´" },
    { name: "Post-Operative Spinal Fusion", category: "musculoskeletal", icon: "ðŸ¦´" },
    { name: "Post-Operative Laminectomy", category: "musculoskeletal", icon: "ðŸ¦´" },
    { name: "ORIF Fracture Rehabilitation", category: "musculoskeletal", icon: "ðŸ¦´" },
    
    // Cardio & Pulmonary
    { name: "Hypertension", category: "cardio_pulmonary", icon: "â¤ï¸" },
    { name: "Hypotension", category: "cardio_pulmonary", icon: "â¤ï¸" },
    { name: "Postural Orthostatic Tachycardia Syndrome (POTS)", category: "cardio_pulmonary", icon: "â¤ï¸" },
    { name: "Coronary Artery Disease", category: "cardio_pulmonary", icon: "â¤ï¸" },
    { name: "Angina", category: "cardio_pulmonary", icon: "â¤ï¸" },
    { name: "Myocardial Infarction (Post-MI Rehab)", category: "cardio_pulmonary", icon: "â¤ï¸" },
    { name: "Congestive Heart Failure (HFrEF/HFpEF)", category: "cardio_pulmonary", icon: "â¤ï¸" },
    { name: "Dilated Cardiomyopathy", category: "cardio_pulmonary", icon: "â¤ï¸" },
    { name: "Arrhythmias (AF/SVT/PVCs)", category: "cardio_pulmonary", icon: "â¤ï¸" },
    { name: "Peripheral Arterial Disease", category: "cardio_pulmonary", icon: "â¤ï¸" },
    { name: "Deep Vein Thrombosis (Post-Acute)", category: "cardio_pulmonary", icon: "â¤ï¸" },
    { name: "Aortic Aneurysm", category: "cardio_pulmonary", icon: "â¤ï¸" },
    { name: "Endocarditis (Post-Acute Recovery)", category: "cardio_pulmonary", icon: "â¤ï¸" },
    { name: "Chronic Oedema", category: "cardio_pulmonary", icon: "â¤ï¸" },
    { name: "Lymphoedema", category: "cardio_pulmonary", icon: "â¤ï¸" },
    { name: "COPD", category: "cardio_pulmonary", icon: "ðŸ«" },
    
    // Metabolic
    { name: "Type 2 Diabetes Mellitus", category: "metabolic", icon: "ðŸ’‰" },
    { name: "Type 1 Diabetes Mellitus", category: "metabolic", icon: "ðŸ’‰" },
    { name: "Pre-Diabetes", category: "metabolic", icon: "ðŸ’‰" },
    { name: "Metabolic Syndrome", category: "metabolic", icon: "ðŸ’‰" },
    { name: "Obesity Class I", category: "metabolic", icon: "âš–ï¸" },
    { name: "Obesity Class II", category: "metabolic", icon: "âš–ï¸" },
    { name: "Obesity Class III", category: "metabolic", icon: "âš–ï¸" },
    { name: "Non-Alcoholic Fatty Liver Disease (NAFLD)", category: "metabolic", icon: "ðŸ’‰" },
    { name: "Polycystic Ovary Syndrome (PCOS)", category: "metabolic", icon: "ðŸ’‰" },
    { name: "Dyslipidaemia", category: "metabolic", icon: "ðŸ’‰" },
    { name: "Hypercholesterolaemia", category: "metabolic", icon: "ðŸ’‰" },
    { name: "Gout", category: "metabolic", icon: "ðŸ’‰" },
    { name: "Hypothyroidism", category: "metabolic", icon: "ðŸ’‰" },
    { name: "Hyperthyroidism", category: "metabolic", icon: "ðŸ’‰" },
    { name: "Chronic Kidney Disease (Stage 1-4)", category: "metabolic", icon: "ðŸ’‰" },
    { name: "Bariatric Surgery Pre/Post Rehabilitation", category: "metabolic", icon: "âš–ï¸" },
    
    // Neurological
    { name: "Parkinson's Disease", category: "neurological", icon: "ðŸ§ " },
    { name: "Multiple Sclerosis", category: "neurological", icon: "ðŸ§ " },
    { name: "Motor Neuron Disease", category: "neurological", icon: "ðŸ§ " },
    { name: "Peripheral Neuropathy", category: "neurological", icon: "ðŸ§ " },
    { name: "Diabetic Neuropathy", category: "neurological", icon: "ðŸ§ " },
    { name: "Traumatic Brain Injury (TBI)", category: "neurological", icon: "ðŸ§ " },
    { name: "Stroke (Ischaemic)", category: "neurological", icon: "ðŸ§ " },
    { name: "Stroke (Haemorrhagic)", category: "neurological", icon: "ðŸ§ " },
    { name: "Spinal Cord Injury (Incomplete/Complete)", category: "neurological", icon: "ðŸ§ " },
    { name: "Cerebral Palsy (Adult)", category: "neurological", icon: "ðŸ§ " },
    { name: "Functional Neurological Disorder (FND)", category: "neurological", icon: "ðŸ§ " },
    { name: "Dystonia", category: "neurological", icon: "ðŸ§ " },
    { name: "Ataxia", category: "neurological", icon: "ðŸ§ " },
    { name: "Cerebellar Degeneration", category: "neurological", icon: "ðŸ§ " },
    { name: "Guillain-Barre Syndrome", category: "neurological", icon: "ðŸ§ " },
    { name: "Post-Concussion Syndrome", category: "neurological", icon: "ðŸ§ " },
    { name: "Vestibular Hypofunction", category: "neurological", icon: "ðŸ§ " },
    { name: "BPPV", category: "neurological", icon: "ðŸ§ " },
    
    // Mental Health
    { name: "Depression (Mild)", category: "mental_health", icon: "ðŸ§˜" },
    { name: "Depression (Moderate)", category: "mental_health", icon: "ðŸ§˜" },
    { name: "Depression (Severe)", category: "mental_health", icon: "ðŸ§˜" },
    { name: "Generalised Anxiety Disorder", category: "mental_health", icon: "ðŸ§˜" },
    { name: "Panic Disorder", category: "mental_health", icon: "ðŸ§˜" },
    { name: "PTSD", category: "mental_health", icon: "ðŸ§˜" },
    { name: "Obsessive-Compulsive Disorder", category: "mental_health", icon: "ðŸ§˜" },
    { name: "Bipolar Disorder", category: "mental_health", icon: "ðŸ§˜" },
    { name: "Schizophrenia", category: "mental_health", icon: "ðŸ§˜" },
    { name: "Schizoaffective Disorder", category: "mental_health", icon: "ðŸ§˜" },
    { name: "Eating Disorders (AN/BN/BED)", category: "mental_health", icon: "ðŸ§˜" },
    { name: "ADHD", category: "mental_health", icon: "ðŸ§˜" },
    { name: "Autism Spectrum Disorder", category: "mental_health", icon: "ðŸ§˜" },
    { name: "Intellectual Disability", category: "mental_health", icon: "ðŸ§˜" },
    { name: "Borderline Personality Disorder", category: "mental_health", icon: "ðŸ§˜" },
    { name: "Substance Use Disorder - Alcohol", category: "mental_health", icon: "ðŸ§˜" },
    { name: "Substance Use Disorder - Amphetamines", category: "mental_health", icon: "ðŸ§˜" },
    { name: "Substance Use Disorder - Opioids", category: "mental_health", icon: "ðŸ§˜" },
    { name: "Substance Use Disorder - Benzodiazepines", category: "mental_health", icon: "ðŸ§˜" },
    { name: "Substance Use Disorder - Polysubstance", category: "mental_health", icon: "ðŸ§˜" },
    { name: "Chronic Stress Disorder", category: "mental_health", icon: "ðŸ§˜" },
    { name: "Insomnia", category: "mental_health", icon: "ðŸ§˜" },
    { name: "Sleep Disorders", category: "mental_health", icon: "ðŸ§˜" },
    
    // Geriatric
    { name: "Falls Prevention (Elderly)", category: "geriatric", icon: "ðŸ‘´" },
    { name: "Frailty Syndrome", category: "geriatric", icon: "ðŸ‘´" },
    { name: "Sarcopenia", category: "geriatric", icon: "ðŸ‘´" },
    
    // General
    { name: "Cancer Rehabilitation", category: "general", icon: "ðŸŽ—ï¸" },
    { name: "Chronic Fatigue Syndrome", category: "general", icon: "ðŸŽ—ï¸" },
    { name: "Long COVID", category: "general", icon: "ðŸŽ—ï¸" },
  ];

  const categories = [
    { value: "all", label: "All Categories", icon: Activity },
    { value: "musculoskeletal", label: "Musculoskeletal", icon: Activity },
    { value: "cardio_pulmonary", label: "Cardio & Pulmonary", icon: Activity },
    { value: "metabolic", label: "Metabolic", icon: Activity },
    { value: "neurological", label: "Neurological", icon: Activity },
    { value: "mental_health", label: "Mental Health", icon: Activity },
    { value: "geriatric", label: "Geriatric", icon: Activity },
    { value: "general", label: "General", icon: Activity },
  ];

  const filteredConditions = commonConditions.filter(condition => {
    const matchesSearch = condition.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "all" || condition.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const validateReferences = async (references) => {
    if (!references || references.length === 0) return [];
    
    const verifiedRefs = [];
    for (const ref of references) {
      const doiMatch = ref.citation.match(/10\.\d{4,}\/[^\s]+/);
      if (doiMatch) {
        const doi = doiMatch[0].replace(/[.,;)]+$/, ''); // strip trailing punctuation
        try {
          const response = await fetch(`https://doi.org/api/handles/${doi}`);
          const data = await response.json();
          if (data && data.responseCode === 1) {
            // DOI confirmed exists
            verifiedRefs.push({ ...ref, verified: true, doi });
          }
          // else: DOI does not exist â€” silently drop it
        } catch (error) {
          // Network error â€” silently drop
        }
      }
      // No DOI â€” silently drop
    }
    return verifiedRefs;
  };

  useEffect(() => {
    base44.auth.me().then(u => setCurrentUser(u)).catch(() => {});
  }, []);

  const loadProtocol = async (condition) => {
    setSelectedCondition(condition);
    setIsLoading(true);
    setProtocolData(null);

    try {
      // Try to load from database first
      const protocols = await base44.entities.TreatmentProtocol.filter({ condition_name: condition.name });
      
      if (protocols.length > 0) {
        const protocol = protocols[0];
        // Validate references if they exist
        if (protocol.references) {
          protocol.references = await validateReferences(protocol.references);
        }
        setProtocolData(protocol);
      } else {
        // Generate protocol using AI
        toast.info("Generating protocol from latest research...", { duration: 2000 });
        
        let result;
        try {
          result = await base44.integrations.Core.InvokeLLM({
            prompt: `Create a comprehensive, evidence-based exercise rehabilitation protocol for: ${condition.name}

You are a senior exercise physiologist creating a detailed treatment protocol. Include:

1. OVERVIEW:
- Pathophysiology (what's happening in the body)
- Functional impact on daily life
- Prevalence data

2. ASSESSMENT & SCREENING:
- Key physical assessments
- Validated outcome measures (with abbreviations)
- Screening tools to use
- Evidence supporting these assessments

3. EXERCISE PRESCRIPTION:
- At least 8-12 specific, named exercises with exact dosages (sets, reps, intensity, tempo)
- Exercise types (e.g., resistance, aerobic, flexibility, balance) and purposes
- Detailed modifications for different functional levels (beginner, intermediate, advanced)
- Evidence level for each exercise (e.g., Level 1a, Level 2, etc.)
- Specific equipment needed for each exercise
- Key coaching cues and common errors to avoid
- Frequency, session duration, program duration
- Overall evidence summary

4. PROGRESSION GUIDELINES:
- Multiple phases with specific timelines
- Goals for each phase
- Criteria to progress to next phase
- Evidence base

5. CONTRAINDICATIONS:
- Absolute contraindications (never exercise)
- Relative contraindications (use caution)
- Red flags requiring medical referral

6. EXPECTED OUTCOMES:
- Timeframe for improvements
- Key outcome measures
- Success indicators
- Effect sizes from research

7. META-ANALYSIS SUMMARY:
- Key findings from systematic reviews
- Pooled effect sizes
- Quality of evidence (GRADE)

8. REFERENCES - CRITICAL INSTRUCTIONS:
- ONLY include references that have a REAL, WORKING DOI that you are 100% certain exists
- Every reference MUST include a complete DOI in format: https://doi.org/10.XXXX/XXXXX
- The DOI will be verified programmatically against doi.org â€” fake or guessed DOIs will fail verification and be silently discarded
- If you are not certain a DOI is real and working, DO NOT include that reference at all
- It is far better to return 0 references than to include any fabricated or uncertain citations
- Prefer high-impact guidelines (ACSM, Cochrane, ESSA) and systematic reviews from well-known journals
- NEVER guess, construct, or partially remember a DOI â€” only include DOIs you know with certainty
- Citation format: Author, A. B., & Author, C. D. (Year). Title of article. Journal Name, volume(issue), pages. https://doi.org/10.XXXX/XXXXX

9. CLINICAL NOTE:
- Brief reminder about clinical judgment and individualization

Be specific, evidence-based, and practical for clinical use.`,
          add_context_from_internet: true,
          response_json_schema: {
            type: "object",
            properties: {
              overview: {
                type: "object",
                properties: {
                  pathophysiology: { type: "string" },
                  functional_impact: { type: "string" },
                  prevalence: { type: "string" }
                }
              },
              assessment: {
                type: "object",
                properties: {
                  key_assessments: { type: "array", items: { type: "string" } },
                  outcome_measures: { type: "array", items: { type: "string" } },
                  screening_tools: { type: "array", items: { type: "string" } },
                  evidence_base: { type: "string" }
                }
              },
              exercise_prescription: {
                type: "object",
                properties: {
                  exercises: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        type: { type: "string" },
                        dosage: { type: "string" },
                        purpose: { type: "string" },
                        modifications: { type: "string" },
                        evidence_level: { type: "string" },
                        equipment: { type: "string" },
                        coaching_cues: { type: "string" }
                      }
                    }
                  },
                  frequency: { type: "string" },
                  session_duration: { type: "string" },
                  program_duration: { type: "string" },
                  evidence_summary: { type: "string" }
                }
              },
              progression: {
                type: "object",
                properties: {
                  phases: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        phase_name: { type: "string" },
                        duration: { type: "string" },
                        goals: { type: "string" },
                        criteria: { type: "string" }
                      }
                    }
                  },
                  evidence_base: { type: "string" }
                }
              },
              contraindications: {
                type: "object",
                properties: {
                  absolute: { type: "array", items: { type: "string" } },
                  relative: { type: "array", items: { type: "string" } },
                  red_flags: { type: "array", items: { type: "string" } }
                }
              },
              outcomes: {
                type: "object",
                properties: {
                  expected_timeframe: { type: "string" },
                  key_outcomes: { type: "array", items: { type: "string" } },
                  success_indicators: { type: "array", items: { type: "string" } },
                  effect_sizes: { type: "string" }
                }
              },
              meta_analysis_summary: {
                type: "object",
                properties: {
                  key_findings: { type: "array", items: { type: "string" } },
                  pooled_effects: { type: "string" },
                  quality_of_evidence: { type: "string" }
                }
              },
              references: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    citation: { type: "string" },
                    key_finding: { type: "string" },
                    study_type: { type: "string" }
                  }
                }
              },
              clinical_note: { type: "string" }
            }
          }
        });
        } catch (internetError) {
          console.warn("Failed with internet context, retrying without:", internetError);
          
          // Fallback: try without internet context
          result = await base44.integrations.Core.InvokeLLM({
            prompt: `Create a comprehensive, evidence-based exercise rehabilitation protocol for: ${condition.name}

You are a senior exercise physiologist creating a detailed treatment protocol. Include:

1. OVERVIEW:
- Pathophysiology (what's happening in the body)
- Functional impact on daily life
- Prevalence data

2. ASSESSMENT & SCREENING:
- Key physical assessments
- Validated outcome measures (with abbreviations)
- Screening tools to use
- Evidence supporting these assessments

3. EXERCISE PRESCRIPTION:
- At least 8-12 specific, named exercises with exact dosages (sets, reps, intensity, tempo)
- Exercise types (e.g., resistance, aerobic, flexibility, balance) and purposes
- Detailed modifications for different functional levels (beginner, intermediate, advanced)
- Evidence level for each exercise (e.g., Level 1a, Level 2, etc.)
- Specific equipment needed for each exercise
- Key coaching cues and common errors to avoid
- Frequency, session duration, program duration
- Overall evidence summary

4. PROGRESSION GUIDELINES:
- Multiple phases with specific timelines
- Goals for each phase
- Criteria to progress to next phase
- Evidence base

5. CONTRAINDICATIONS:
- Absolute contraindications (never exercise)
- Relative contraindications (use caution)
- Red flags requiring medical referral

6. EXPECTED OUTCOMES:
- Timeframe for improvements
- Key outcome measures
- Success indicators
- Effect sizes from research

7. META-ANALYSIS SUMMARY:
- Key findings from systematic reviews
- Pooled effect sizes
- Quality of evidence (GRADE)

8. REFERENCES - CRITICAL INSTRUCTIONS:
- ONLY include references that have a REAL, WORKING DOI that you are 100% certain exists
- Every reference MUST include a complete DOI in format: https://doi.org/10.XXXX/XXXXX
- The DOI will be verified programmatically against doi.org â€” fake or guessed DOIs will fail verification and be silently discarded
- If you are not certain a DOI is real and working, DO NOT include that reference at all
- It is far better to return 0 references than to include any fabricated or uncertain citations
- Prefer high-impact guidelines (ACSM, Cochrane, ESSA) and systematic reviews from well-known journals
- NEVER guess, construct, or partially remember a DOI â€” only include DOIs you know with certainty
- Citation format: Author, A. B., & Author, C. D. (Year). Title of article. Journal Name, volume(issue), pages. https://doi.org/10.XXXX/XXXXX

9. CLINICAL NOTE:
- Brief reminder about clinical judgment and individualization

Be specific, evidence-based, and practical for clinical use.`,
            add_context_from_internet: false,
            response_json_schema: {
              type: "object",
              properties: {
                overview: {
                  type: "object",
                  properties: {
                    pathophysiology: { type: "string" },
                    functional_impact: { type: "string" },
                    prevalence: { type: "string" }
                  }
                },
                assessment: {
                  type: "object",
                  properties: {
                    key_assessments: { type: "array", items: { type: "string" } },
                    outcome_measures: { type: "array", items: { type: "string" } },
                    screening_tools: { type: "array", items: { type: "string" } },
                    evidence_base: { type: "string" }
                  }
                },
                exercise_prescription: {
                  type: "object",
                  properties: {
                    exercises: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          name: { type: "string" },
                          type: { type: "string" },
                          dosage: { type: "string" },
                          purpose: { type: "string" },
                          modifications: { type: "string" },
                          evidence_level: { type: "string" }
                        }
                      }
                    },
                    frequency: { type: "string" },
                    session_duration: { type: "string" },
                    program_duration: { type: "string" },
                    evidence_summary: { type: "string" }
                  }
                },
                progression: {
                  type: "object",
                  properties: {
                    phases: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          phase_name: { type: "string" },
                          duration: { type: "string" },
                          goals: { type: "string" },
                          criteria: { type: "string" }
                        }
                      }
                    },
                    evidence_base: { type: "string" }
                  }
                },
                contraindications: {
                  type: "object",
                  properties: {
                    absolute: { type: "array", items: { type: "string" } },
                    relative: { type: "array", items: { type: "string" } },
                    red_flags: { type: "array", items: { type: "string" } }
                  }
                },
                outcomes: {
                  type: "object",
                  properties: {
                    expected_timeframe: { type: "string" },
                    key_outcomes: { type: "array", items: { type: "string" } },
                    success_indicators: { type: "array", items: { type: "string" } },
                    effect_sizes: { type: "string" }
                  }
                },
                meta_analysis_summary: {
                  type: "object",
                  properties: {
                    key_findings: { type: "array", items: { type: "string" } },
                    pooled_effects: { type: "string" },
                    quality_of_evidence: { type: "string" }
                  }
                },
                references: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      citation: { type: "string" },
                      key_finding: { type: "string" },
                      study_type: { type: "string" }
                    }
                  }
                },
                clinical_note: { type: "string" }
              }
            }
          });
        }

        // Validate references before displaying
        if (result.references) {
          result.references = await validateReferences(result.references);
        }
        
        setProtocolData(result);
      }
    } catch (error) {
      console.error("Error loading protocol:", error);
      toast.error(`Failed to load treatment protocol: ${error.message || 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  return (
    <>
      <Toaster richColors position="top-center" />
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30 p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-green-600 rounded-lg flex items-center justify-center shadow-md">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Treatment Protocols</h1>
              <p className="text-slate-600">Evidence-based exercise rehabilitation protocols</p>
            </div>
          </div>

          {/* Protocol disclaimer popup */}
          {!disclaimerDismissed && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
              <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full mx-4 p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                    <AlertTriangle className="w-5 h-5 text-amber-500" />
                  </div>
                  <h3 className="font-semibold text-slate-900 text-base">Clinical Reminder</h3>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed mb-5">
                  Protocols are <strong>reference frameworks only</strong> â€” adapt to each client's unique presentation. Your clinical judgement applies at all times.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => { window.history.back(); }}
                    className="flex-1 py-2 px-4 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      setDisclaimerDismissed(true);
                      try {
                        const ip = await fetch('https://api.ipify.org?format=json').then(r=>r.json()).then(d=>d.ip).catch(()=>'unknown');
                        await base44.entities.LegalAcceptance.create({
                          user_email: currentUser?.email || 'unknown',
                          user_role: currentUser?.role === 'admin' ? 'Admin' : 'Clinician',
                          document_set_id: "allied-assess-treatment-protocol-disclaimer-v1",
                          document_set_version: "1.0.0",
                          accepted_documents: ["treatment_protocol_disclaimer"],
                          accepted: true,
                          ip_address: ip,
                          user_agent: navigator.userAgent,
                          session_timestamp: new Date().toISOString()
                        });
                      } catch(e) { console.error('Failed to log disclaimer:', e); }
                    }}
                    className="flex-1 py-2 px-4 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
                  >
                    Acknowledge
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Left Sidebar - Condition Search */}
            {!sidebarCollapsed && (
            <div className="lg:col-span-1">
              <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 sticky top-6">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Select Condition</CardTitle>
                    {protocolData && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSidebarCollapsed(true)}
                        className="flex items-center gap-1"
                      >
                        <ChevronDown className="h-4 w-4 rotate-90" />
                        <span className="text-xs">Hide</span>
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                      <Input
                        placeholder="Search or enter custom condition..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && searchTerm.trim()) {
                            loadProtocol({ 
                              name: searchTerm.trim(), 
                              category: 'general', 
                              icon: 'ðŸ”' 
                            });
                          }
                        }}
                        className="pl-10"
                      />
                    </div>
                    {searchTerm && !filteredConditions.some(c => c.name.toLowerCase() === searchTerm.toLowerCase()) && (
                      <Button
                        variant="default"
                        className="w-full bg-blue-600 hover:bg-blue-700"
                        onClick={() => loadProtocol({ 
                          name: searchTerm.trim(), 
                          category: 'general', 
                          icon: 'ðŸ”' 
                        })}
                      >
                        <Search className="w-4 h-4 mr-2" />
                        Generate Protocol for "{searchTerm}"
                      </Button>
                    )}
                  </div>

                  <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
                    <TabsList className="grid grid-cols-2 gap-2">
                      <TabsTrigger value="all">All</TabsTrigger>
                      <TabsTrigger value="musculoskeletal">MSK</TabsTrigger>
                    </TabsList>
                    <TabsList className="grid grid-cols-2 gap-2 mt-2">
                      <TabsTrigger value="cardio_pulmonary">Cardio</TabsTrigger>
                      <TabsTrigger value="metabolic">Metabolic</TabsTrigger>
                    </TabsList>
                    <TabsList className="grid grid-cols-2 gap-2 mt-2">
                      <TabsTrigger value="neurological">Neuro</TabsTrigger>
                      <TabsTrigger value="mental_health">Mental</TabsTrigger>
                    </TabsList>
                  </Tabs>

                  <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                    {filteredConditions.map((condition, index) => (
                      <Button
                        key={index}
                        variant={selectedCondition?.name === condition.name ? "default" : "outline"}
                        className="w-full justify-start h-auto py-3 text-left"
                        onClick={() => loadProtocol(condition)}
                      >
                        <span className="mr-2 text-lg">{condition.icon}</span>
                        <span className="flex-1">{condition.name}</span>
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
            )}

            {/* Collapsed Sidebar Button */}
            {sidebarCollapsed && (
              <div className="fixed left-6 top-24 z-50">
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => setSidebarCollapsed(false)}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <ChevronDown className="h-4 w-4 -rotate-90 mr-2" />
                  Show Conditions
                </Button>
              </div>
            )}

            {/* Right Content - Protocol Details */}
            <div className={sidebarCollapsed ? "lg:col-span-3" : "lg:col-span-2"}>
              {!selectedCondition && !isLoading && (
                <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
                  <CardContent className="py-12 text-center">
                    <BookOpen className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                    <h3 className="text-xl font-semibold text-slate-900 mb-2">
                      Select a Condition
                    </h3>
                    <p className="text-slate-600">
                      Choose a condition from the left to view evidence-based treatment protocols
                    </p>
                  </CardContent>
                </Card>
              )}

              {isLoading && (
                <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
                  <CardContent className="py-12">
                    <div className="flex flex-col items-center gap-4">
                      <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
                      <p className="text-slate-600">
                        Loading treatment protocol for {selectedCondition?.name}...
                      </p>
                      <p className="text-sm text-slate-500">
                        Retrieving latest evidence-based research
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {protocolData && !isLoading && (
                <div className="space-y-4">
                  {/* Header Card */}
                  <Card className="bg-gradient-to-r from-green-50 to-blue-50 border-green-200">
                    <CardHeader>
                      <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                        <div>
                          <CardTitle className="text-2xl text-slate-900 mb-2">
                            {selectedCondition?.icon} {selectedCondition?.name}
                          </CardTitle>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="secondary" className="capitalize">
                              {selectedCondition?.category.replace(/_/g, ' ')}
                            </Badge>
                          </div>
                        </div>
                        <Button
                          onClick={() => setShowImportModal(true)}
                          className="bg-blue-600 hover:bg-blue-700 shrink-0"
                        >
                          <FileText className="w-4 h-4 mr-2" />
                          Add to Client Plan
                        </Button>
                      </div>
                    </CardHeader>
                  </Card>

                  {/* Clinical Judgment & Responsibility Note - Moved to Top */}
                  <Card className="bg-amber-50 border-amber-300">
                    <CardContent className="py-4">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <h4 className="font-semibold text-amber-900 mb-1">Clinical Responsibility & Professional Judgment</h4>
                          <p className="text-sm text-amber-800 mb-3">
                            {protocolData.clinical_note || "These guidelines are based on current evidence and should be adapted to each patient's individual needs and circumstances."}
                          </p>
                          <div className="bg-amber-100 border border-amber-300 rounded-lg p-3 mt-2">
                            <p className="text-sm text-amber-900 font-medium mb-2">Important Clinician Responsibilities:</p>
                            <ul className="text-xs text-amber-800 space-y-1.5 list-disc list-inside">
                              <li><strong>Exercise Prescription:</strong> The clinician is solely responsible for ensuring all exercise prescriptions are appropriate, safe, and correctly dosed for each individual client.</li>
                              <li><strong>Assessment & Testing:</strong> All assessment protocols, testing procedures, and outcome measures must be verified and correctly administered by the treating clinician.</li>
                              <li><strong>Progression Decisions:</strong> Clinical decisions regarding exercise progression, regression, or modification remain the exclusive responsibility of the treating clinician.</li>
                              <li><strong>Contraindication Screening:</strong> The clinician must independently screen for and identify all contraindications and precautions relevant to each client.</li>
                              <li><strong>Evidence Verification:</strong> While these protocols are evidence-informed, clinicians should verify references and stay current with emerging research in their area of practice.</li>
                              <li><strong>Documentation:</strong> Accurate documentation of clinical reasoning, client responses, and any deviations from suggested protocols is the clinician's responsibility.</li>
                            </ul>
                            <p className="text-xs text-amber-900 mt-3 italic">
                              This information is provided as a clinical decision support tool only. It does not replace professional clinical judgment, formal training, or regulatory requirements for exercise prescription.
                            </p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Overview */}
                  <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
                    <CardHeader className="cursor-pointer" onClick={() => toggleSection('overview')}>
                      <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                          <BookOpen className="w-5 h-5 text-blue-600" />
                          Condition Overview
                        </CardTitle>
                        {expandedSections.overview ? <ChevronUp /> : <ChevronDown />}
                      </div>
                    </CardHeader>
                    {expandedSections.overview && (
                      <CardContent className="space-y-4">
                        {protocolData.overview?.pathophysiology && (
                          <div>
                            <h4 className="font-semibold text-slate-800 mb-2">Pathophysiology</h4>
                            <p className="text-slate-600 leading-relaxed">{protocolData.overview.pathophysiology}</p>
                          </div>
                        )}
                        {protocolData.overview?.functional_impact && (
                          <div>
                            <h4 className="font-semibold text-slate-800 mb-2">Functional Impact</h4>
                            <p className="text-slate-600 leading-relaxed">{protocolData.overview.functional_impact}</p>
                          </div>
                        )}
                        {protocolData.overview?.prevalence && (
                          <div>
                            <h4 className="font-semibold text-slate-800 mb-2">Prevalence</h4>
                            <p className="text-slate-600 leading-relaxed">{protocolData.overview.prevalence}</p>
                          </div>
                        )}
                      </CardContent>
                    )}
                  </Card>

                  {/* Assessment & Screening */}
                  <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
                   <CardHeader className="cursor-pointer" onClick={() => toggleSection('assessment')}>
                     <div className="flex items-center justify-between">
                       <CardTitle className="flex items-center gap-2">
                         <Target className="w-5 h-5 text-purple-600" />
                         Assessment & Screening
                       </CardTitle>
                       {expandedSections.assessment ? <ChevronUp /> : <ChevronDown />}
                     </div>
                   </CardHeader>
                   {expandedSections.assessment && (
                     <CardContent className="space-y-4">
                       {protocolData.assessment?.key_assessments && (
                         <div>
                           <h4 className="font-semibold text-slate-800 mb-2">Key Assessments</h4>
                           <ul className="list-disc list-inside space-y-1 text-slate-600">
                             {protocolData.assessment.key_assessments.map((item, i) => (
                               <li key={i}>{item}</li>
                             ))}
                           </ul>
                         </div>
                       )}
                       {protocolData.assessment?.outcome_measures && (
                         <div>
                           <h4 className="font-semibold text-slate-800 mb-2">Outcome Measures</h4>
                           <ul className="list-disc list-inside space-y-1 text-slate-600">
                             {protocolData.assessment.outcome_measures.map((item, i) => (
                               <li key={i}>{item}</li>
                             ))}
                           </ul>
                         </div>
                       )}
                       {protocolData.assessment?.screening_tools && (
                         <div>
                           <h4 className="font-semibold text-slate-800 mb-2">Screening Tools</h4>
                           <ul className="list-disc list-inside space-y-1 text-slate-600">
                             {protocolData.assessment.screening_tools.map((item, i) => (
                               <li key={i}>{item}</li>
                             ))}
                           </ul>
                         </div>
                       )}
                       {protocolData.assessment?.evidence_base && (
                         <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                           <h4 className="font-semibold text-purple-800 mb-2 text-sm">Evidence Base</h4>
                           <p className="text-sm text-slate-700">{protocolData.assessment.evidence_base}</p>
                         </div>
                       )}
                     </CardContent>
                   )}
                  </Card>

                  {/* Exercise Prescription */}
                  <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
                   <CardHeader className="cursor-pointer" onClick={() => toggleSection('exercises')}>
                     <div className="flex items-center justify-between">
                       <CardTitle className="flex items-center gap-2">
                         <Activity className="w-5 h-5 text-green-600" />
                         Exercise Prescription
                       </CardTitle>
                       {expandedSections.exercises ? <ChevronUp /> : <ChevronDown />}
                     </div>
                   </CardHeader>
                   {expandedSections.exercises && (
                     <CardContent className="space-y-4">
                       {protocolData.exercise_prescription?.evidence_summary && (
                         <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                           <h4 className="font-semibold text-green-800 mb-2 text-sm">Evidence Summary</h4>
                           <p className="text-sm text-slate-700">{protocolData.exercise_prescription.evidence_summary}</p>
                         </div>
                       )}
                       {protocolData.exercise_prescription?.exercises && (
                         <div className="space-y-3">
                           {protocolData.exercise_prescription.exercises.map((exercise, i) => (
                             <div key={i} className="p-4 bg-slate-50 rounded-lg border border-slate-200 hover:shadow-md transition-shadow">
                               <div className="flex items-start justify-between mb-3">
                                 <div className="flex items-center gap-2">
                                   <span className="font-semibold text-slate-900 text-base">{i + 1}.</span>
                                   <h4 className="font-semibold text-slate-900 text-base">{exercise.name}</h4>
                                 </div>
                                 <div className="flex gap-2 flex-wrap justify-end">
                                   <Badge variant="outline" className="text-xs">{exercise.type}</Badge>
                                   {exercise.evidence_level && (
                                     <Badge className="bg-blue-100 text-blue-800 border-0 text-xs">{exercise.evidence_level}</Badge>
                                   )}
                                 </div>
                               </div>
                               <div className="space-y-2 ml-6">
                                 <p className="text-sm text-slate-600"><span className="font-semibold text-slate-700">Dosage:</span> {exercise.dosage}</p>
                                 <p className="text-sm text-slate-600"><span className="font-semibold text-slate-700">Purpose:</span> {exercise.purpose}</p>
                                 {exercise.equipment && (
                                   <p className="text-sm text-slate-600"><span className="font-semibold text-slate-700">Equipment:</span> {exercise.equipment}</p>
                                 )}
                                 {exercise.modifications && (
                                   <div className="p-2 bg-amber-50 rounded border border-amber-200">
                                     <p className="text-sm text-slate-700"><span className="font-semibold text-amber-800">Modifications:</span> {exercise.modifications}</p>
                                   </div>
                                 )}
                                 {exercise.coaching_cues && (
                                   <div className="p-2 bg-blue-50 rounded border border-blue-200">
                                     <p className="text-sm text-slate-700"><span className="font-semibold text-blue-800">Coaching Cues:</span> {exercise.coaching_cues}</p>
                                   </div>
                                 )}
                               </div>
                             </div>
                           ))}
                         </div>
                       )}
                       <div className="grid md:grid-cols-3 gap-4 mt-4">
                         {protocolData.exercise_prescription?.frequency && (
                           <div className="p-3 bg-blue-50 rounded-lg">
                             <p className="text-xs text-blue-600 font-semibold mb-1">Frequency</p>
                             <p className="text-sm text-slate-900">{protocolData.exercise_prescription.frequency}</p>
                           </div>
                         )}
                         {protocolData.exercise_prescription?.session_duration && (
                           <div className="p-3 bg-green-50 rounded-lg">
                             <p className="text-xs text-green-600 font-semibold mb-1">Session Duration</p>
                             <p className="text-sm text-slate-900">{protocolData.exercise_prescription.session_duration}</p>
                           </div>
                         )}
                         {protocolData.exercise_prescription?.program_duration && (
                           <div className="p-3 bg-purple-50 rounded-lg">
                             <p className="text-xs text-purple-600 font-semibold mb-1">Program Duration</p>
                             <p className="text-sm text-slate-900">{protocolData.exercise_prescription.program_duration}</p>
                           </div>
                         )}
                       </div>
                     </CardContent>
                   )}
                  </Card>

                  {/* Progression */}
                  <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
                   <CardHeader className="cursor-pointer" onClick={() => toggleSection('progression')}>
                     <div className="flex items-center justify-between">
                       <CardTitle className="flex items-center gap-2">
                         <TrendingUp className="w-5 h-5 text-orange-600" />
                         Progression Guidelines
                       </CardTitle>
                       {expandedSections.progression ? <ChevronUp /> : <ChevronDown />}
                     </div>
                   </CardHeader>
                   {expandedSections.progression && (
                     <CardContent className="space-y-3">
                       {protocolData.progression?.evidence_base && (
                         <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                           <h4 className="font-semibold text-orange-800 mb-2 text-sm">Evidence Base</h4>
                           <p className="text-sm text-slate-700">{protocolData.progression.evidence_base}</p>
                         </div>
                       )}
                       {protocolData.progression?.phases && (
                         <>
                           {protocolData.progression.phases.map((phase, i) => (
                             <div key={i} className="p-4 bg-gradient-to-r from-orange-50 to-yellow-50 rounded-lg border border-orange-200">
                               <div className="flex items-center gap-2 mb-2">
                                 <Badge className="bg-orange-600">Phase {i + 1}</Badge>
                                 <h4 className="font-semibold text-slate-900">{phase.phase_name}</h4>
                               </div>
                               <p className="text-sm text-slate-600 mb-1"><strong>Duration:</strong> {phase.duration}</p>
                               <p className="text-sm text-slate-600 mb-1"><strong>Goals:</strong> {phase.goals}</p>
                               <p className="text-sm text-slate-600"><strong>Progression Criteria:</strong> {phase.criteria}</p>
                             </div>
                           ))}
                         </>
                       )}
                     </CardContent>
                   )}
                  </Card>

                  {/* Contraindications */}
                  <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
                    <CardHeader className="cursor-pointer" onClick={() => toggleSection('contraindications')}>
                      <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                          <AlertTriangle className="w-5 h-5 text-red-600" />
                          Contraindications & Precautions
                        </CardTitle>
                        {expandedSections.contraindications ? <ChevronUp /> : <ChevronDown />}
                      </div>
                    </CardHeader>
                    {expandedSections.contraindications && (
                      <CardContent className="space-y-4">
                        {protocolData.contraindications?.absolute && (
                          <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                            <h4 className="font-semibold text-red-800 mb-2">Absolute Contraindications</h4>
                            <ul className="list-disc list-inside space-y-1 text-red-700">
                              {protocolData.contraindications.absolute.map((item, i) => (
                                <li key={i}>{item}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {protocolData.contraindications?.relative && (
                          <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                            <h4 className="font-semibold text-yellow-800 mb-2">Relative Contraindications</h4>
                            <ul className="list-disc list-inside space-y-1 text-yellow-700">
                              {protocolData.contraindications.relative.map((item, i) => (
                                <li key={i}>{item}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {protocolData.contraindications?.red_flags && (
                          <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                            <h4 className="font-semibold text-orange-800 mb-2">Red Flags</h4>
                            <ul className="list-disc list-inside space-y-1 text-orange-700">
                              {protocolData.contraindications.red_flags.map((item, i) => (
                                <li key={i}>{item}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </CardContent>
                    )}
                  </Card>

                  {/* Expected Outcomes */}
                  <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
                   <CardHeader className="cursor-pointer" onClick={() => toggleSection('outcomes')}>
                     <div className="flex items-center justify-between">
                       <CardTitle className="flex items-center gap-2">
                         <Clock className="w-5 h-5 text-indigo-600" />
                         Expected Outcomes
                       </CardTitle>
                       {expandedSections.outcomes ? <ChevronUp /> : <ChevronDown />}
                     </div>
                   </CardHeader>
                   {expandedSections.outcomes && (
                     <CardContent className="space-y-4">
                       {protocolData.outcomes?.effect_sizes && (
                         <div className="p-3 bg-indigo-50 rounded-lg border border-indigo-200">
                           <h4 className="font-semibold text-indigo-800 mb-2 text-sm">Effect Sizes from Meta-Analyses</h4>
                           <p className="text-sm text-slate-700">{protocolData.outcomes.effect_sizes}</p>
                         </div>
                       )}
                       {protocolData.outcomes?.expected_timeframe && (
                         <div>
                           <h4 className="font-semibold text-slate-800 mb-2">Timeframe</h4>
                           <p className="text-slate-600">{protocolData.outcomes.expected_timeframe}</p>
                         </div>
                       )}
                       {protocolData.outcomes?.key_outcomes && (
                         <div>
                           <h4 className="font-semibold text-slate-800 mb-2">Key Outcomes</h4>
                           <ul className="list-disc list-inside space-y-1 text-slate-600">
                             {protocolData.outcomes.key_outcomes.map((item, i) => (
                               <li key={i}>{item}</li>
                             ))}
                           </ul>
                         </div>
                       )}
                       {protocolData.outcomes?.success_indicators && (
                         <div>
                           <h4 className="font-semibold text-slate-800 mb-2">Success Indicators</h4>
                           <ul className="list-disc list-inside space-y-1 text-slate-600">
                             {protocolData.outcomes.success_indicators.map((item, i) => (
                               <li key={i}>{item}</li>
                             ))}
                           </ul>
                         </div>
                       )}
                     </CardContent>
                   )}
                  </Card>

                  {/* Meta-Analysis Summary */}
                  {protocolData.meta_analysis_summary && (
                   <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
                     <CardHeader className="cursor-pointer" onClick={() => toggleSection('meta_analysis')}>
                       <div className="flex items-center justify-between">
                         <CardTitle className="flex items-center gap-2">
                           <BookOpen className="w-5 h-5 text-blue-600" />
                           Meta-Analysis Summary
                         </CardTitle>
                         {expandedSections.meta_analysis ? <ChevronUp /> : <ChevronDown />}
                       </div>
                     </CardHeader>
                     {expandedSections.meta_analysis && (
                       <CardContent className="space-y-4">
                         {protocolData.meta_analysis_summary.key_findings && (
                           <div>
                             <h4 className="font-semibold text-slate-800 mb-2">Key Findings</h4>
                             <ul className="list-disc list-inside space-y-1 text-slate-600">
                               {protocolData.meta_analysis_summary.key_findings.map((finding, i) => (
                                 <li key={i}>{finding}</li>
                               ))}
                             </ul>
                           </div>
                         )}
                         {protocolData.meta_analysis_summary.pooled_effects && (
                           <div className="p-3 bg-blue-50 rounded-lg">
                             <h4 className="font-semibold text-blue-800 mb-2 text-sm">Pooled Effects</h4>
                             <p className="text-sm text-slate-700">{protocolData.meta_analysis_summary.pooled_effects}</p>
                           </div>
                         )}
                         {protocolData.meta_analysis_summary.quality_of_evidence && (
                           <div className="p-3 bg-green-50 rounded-lg">
                             <h4 className="font-semibold text-green-800 mb-2 text-sm">Quality of Evidence</h4>
                             <p className="text-sm text-slate-700">{protocolData.meta_analysis_summary.quality_of_evidence}</p>
                           </div>
                         )}
                       </CardContent>
                     )}
                   </Card>
                  )}

                  {/* References */}
                  <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
                   <CardHeader className="cursor-pointer" onClick={() => toggleSection('references')}>
                     <div className="flex items-center justify-between">
                       <CardTitle className="flex items-center gap-2">
                         <ExternalLink className="w-5 h-5 text-slate-600" />
                         Key References
                       </CardTitle>
                       {expandedSections.references ? <ChevronUp /> : <ChevronDown />}
                     </div>
                   </CardHeader>
                   {expandedSections.references && (
                     <CardContent>
                       {protocolData.references && protocolData.references.length > 0 ? (
                         <div className="space-y-3">
                           {protocolData.references.map((ref, i) => (
                             <div key={i} className="p-3 rounded-lg border bg-green-50 border-green-200">
                               <div className="flex items-start justify-between gap-2 mb-1">
                                 <div className="text-sm text-slate-900 flex-1">
                                   <ClickableReferences references={ref.citation} />
                                 </div>
                                 <div className="flex gap-1 flex-shrink-0">
                                   <Badge className="bg-green-600 text-white text-xs">âœ“ Verified</Badge>
                                   {ref.study_type && (
                                     <Badge variant="outline" className="text-xs">{ref.study_type}</Badge>
                                   )}
                                 </div>
                               </div>
                               {ref.key_finding && (
                                 <p className="text-xs text-slate-600 italic mt-1">Key Finding: {ref.key_finding}</p>
                               )}
                             </div>
                           ))}
                         </div>
                       ) : (
                         <p className="text-sm text-slate-500 italic">No verified references available for this protocol. Consult current clinical practice guidelines and peer-reviewed literature directly.</p>
                       )}
                     </CardContent>
                     )}
                     </Card>
                     </div>
                     )}
            </div>
          </div>
        </div>
      </div>

      <ImportToSOAPModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        protocolData={protocolData}
        conditionName={selectedCondition?.name}
      />
</>
  );
}