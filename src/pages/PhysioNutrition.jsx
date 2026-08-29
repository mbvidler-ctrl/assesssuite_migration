import React, { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  ClipboardCheck,
  Droplets,
  ExternalLink,
  FileText,
  HeartPulse,
  Search,
  UserPlus,
  Utensils,
} from "lucide-react";

import { base44 } from "@/api/base44Client";
import NutritionPlanCreator from "@/components/client/NutritionPlanCreator";
import NutritionPlanViewer from "@/components/client/NutritionPlanViewer";
import FoodDiaryTemplate from "@/components/nutrition/FoodDiaryTemplate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

const SCREENING_DOMAINS = [
  {
    title: "Intake, weight and appetite",
    icon: ClipboardCheck,
    prompts: [
      "Recent unplanned weight loss or gain, appetite change, food insecurity or difficulty preparing meals",
      "Relevant medical conditions, medications, allergies, dietary pattern and recent pathology already supplied by the treating team",
      "Effect on strength, fatigue, tissue healing, exercise tolerance, function and participation",
    ],
  },
  {
    title: "Hydration and cardiorespiratory tolerance",
    icon: Droplets,
    prompts: [
      "Usual fluid intake and factors increasing loss or limiting access to fluids",
      "Symptoms during treatment such as postural dizziness, cramping, headache, heat intolerance or unusual fatigue",
      "Any medical fluid restriction or heart, renal or endocrine condition requiring individual medical advice",
    ],
  },
  {
    title: "Swallowing, feeding and safety",
    icon: AlertTriangle,
    prompts: [
      "Coughing or choking with food or drink, wet voice, recurrent chest infection, prolonged meals or unexplained weight loss",
      "Paediatric feeding or growth concerns, sensory or oral-motor difficulties, and caregiver-reported changes",
      "Escalate urgent airway or aspiration concerns and coordinate speech pathology, dietetic and medical review",
    ],
  },
  {
    title: "Recovery, bone, muscle and tissue health",
    icon: Activity,
    prompts: [
      "Recovery between sessions, wound or pressure-injury healing, recurrent injury, low energy availability or menstrual change",
      "Frailty, sarcopenia, fracture risk, restrictive eating, gastrointestinal symptoms or supplement use",
      "Integrate identified factors with loading, pacing, falls prevention, rehabilitation goals and review timing",
    ],
  },
];

const WORKFLOW = [
  "Screen nutrition and hydration factors during intake and when recovery, function or tissue healing changes.",
  "Record clinically relevant findings in the episode, assessment and SOAP note rather than leaving them in a disconnected checklist.",
  "Use the patient-plan tool for general healthy-eating, hydration and behaviour education linked to physiotherapy goals.",
  "Coordinate or refer where the patient requires therapeutic dietary prescription, swallowing management, eating-disorder care or medical investigation.",
  "Review the plan against adherence, symptoms, objective outcomes and functional progress at the next relevant consultation.",
];

const RESOURCES = [
  {
    title: "Australian Dietary Guidelines",
    description: "National evidence-based healthy-eating guidance and clinician resources.",
    url: "https://www.eatforhealth.gov.au/guidelines",
  },
  {
    title: "Australian Guide to Healthy Eating",
    description: "Food-group, serve and patient-education resources for general healthy-eating discussions.",
    url: "https://www.eatforhealth.gov.au/guidelines/australian-guide-healthy-eating",
  },
  {
    title: "Nutrient Reference Values",
    description: "Australian and New Zealand reference values for energy and nutrient intake.",
    url: "https://www.eatforhealth.gov.au/nutrient-reference-values",
  },
  {
    title: "Find an Accredited Practising Dietitian",
    description: "Referral directory for individualised nutrition assessment and medical nutrition therapy.",
    url: "https://dietitiansaustralia.org.au/find-an-apd",
  },
  {
    title: "Sports Dietitians Australia",
    description: "Accredited sports-dietitian directory and performance-nutrition resources.",
    url: "https://www.sportsdietitians.com.au/find-a-sports-dietitian/",
  },
  {
    title: "Eating Disorders: health-professional resources",
    description: "National information and referral support for suspected eating disorders or disordered eating.",
    url: "https://butterfly.org.au/health-professionals/",
  },
];

export default function PhysioNutrition() {
  const [clients, setClients] = useState([]);
  const [orgId, setOrgId] = useState(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [foodDiaryOpen, setFoodDiaryOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [creatorOpen, setCreatorOpen] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadOrganisation() {
      try {
        const user = await base44.auth.me();
        const memberships = await base44.entities.OrganizationMember.filter({ user_email: user.email });
        if (!active) return;
        const membership = memberships.find((item) => item.is_primary) || memberships[0];
        if (!membership) {
          setLoading(false);
          toast.error("Your account does not have an organisation membership.");
          return;
        }
        setOrgId(membership.org_id);
      } catch (error) {
        if (!active) return;
        console.error("Unable to load nutrition workspace organisation", error);
        setLoading(false);
        toast.error("Unable to load the nutrition workspace.");
      }
    }
    loadOrganisation();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    async function loadPatients() {
      if (!orgId) return;
      setLoading(true);
      try {
        const records = await base44.entities.Client.filter({ org_id: orgId });
        if (active) setClients(records);
      } catch (error) {
        if (active) {
          console.error("Unable to load patients for nutrition workspace", error);
          toast.error("Unable to load patients.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    loadPatients();
    return () => { active = false; };
  }, [orgId]);

  const filteredClients = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return clients;
    return clients.filter((client) => [client.full_name, client.email, client.phone]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(needle));
  }, [clients, query]);

  async function openPatientPlan(client) {
    setSelectedClient(client);
    try {
      const plans = await base44.entities.ClientNutritionPlan.filter({ client_id: client.id });
      if (plans.length > 0) setViewerOpen(true);
      else setCreatorOpen(true);
    } catch (error) {
      console.error("Unable to inspect existing patient nutrition plans", error);
      setCreatorOpen(true);
    }
  }

  function closePatientTools() {
    setCreatorOpen(false);
    setViewerOpen(false);
    setSelectedClient(null);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-teal-50/40 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div>
          <div className="mb-2 flex items-center gap-3">
            <div className="rounded-xl bg-teal-600 p-3 text-white"><Utensils className="h-6 w-6" /></div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Nutrition, hydration & recovery</h1>
              <p className="text-slate-600">Physiotherapy screening, patient education, care-team coordination and persisted plans</p>
            </div>
          </div>
          <p className="max-w-4xl text-sm leading-6 text-slate-600">
            Use this workspace to identify factors affecting rehabilitation, connect them to the episode of care and create practical patient education. Clinical findings and referrals remain part of the patient record; generated content must be reviewed before use.
          </p>
        </div>

        <Tabs defaultValue="workflow" className="w-full">
          <TabsList className="grid h-auto w-full grid-cols-3 gap-1.5 bg-slate-100 p-1.5">
            <TabsTrigger value="workflow">Clinical workflow</TabsTrigger>
            <TabsTrigger value="patients">Patient plans</TabsTrigger>
            <TabsTrigger value="resources">Resources</TabsTrigger>
          </TabsList>

          <TabsContent value="workflow" className="mt-5 space-y-5">
            <div className="grid gap-4 lg:grid-cols-2">
              {SCREENING_DOMAINS.map(({ title, icon: Icon, prompts }) => (
                <Card key={title} className="border-slate-200 bg-white/95">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg"><Icon className="h-5 w-5 text-teal-600" />{title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2 text-sm leading-6 text-slate-700">
                      {prompts.map((prompt) => <li key={prompt} className="flex items-start gap-2"><span className="mt-1 text-teal-600">•</span><span>{prompt}</span></li>)}
                    </ul>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card className="border-teal-200 bg-teal-50/70">
              <CardHeader><CardTitle className="flex items-center gap-2"><HeartPulse className="h-5 w-5 text-teal-700" />Integrated episode workflow</CardTitle></CardHeader>
              <CardContent>
                <ol className="grid gap-3 md:grid-cols-2">
                  {WORKFLOW.map((step, index) => (
                    <li key={step} className="flex gap-3 rounded-lg border border-teal-100 bg-white p-3 text-sm leading-6 text-slate-700">
                      <Badge className="h-6 min-w-6 justify-center bg-teal-600">{index + 1}</Badge><span>{step}</span>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="patients" className="mt-5 space-y-5">
            <Card className="border-slate-200 bg-white/95">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><UserPlus className="h-5 w-5 text-teal-600" />Create or review a patient plan</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search patient name, email or phone…" className="pl-10" />
                  </div>
                  <Button variant="outline" onClick={() => setFoodDiaryOpen(true)}><FileText className="mr-2 h-4 w-4" />Food diary</Button>
                </div>

                {loading ? (
                  <div className="py-10 text-center text-sm text-slate-500">Loading patients…</div>
                ) : filteredClients.length > 0 ? (
                  <div className="max-h-[32rem] space-y-2 overflow-y-auto">
                    {filteredClients.slice(0, 50).map((client) => (
                      <button key={client.id} type="button" onClick={() => openPatientPlan(client)} className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-teal-300 hover:bg-teal-50">
                        <div>
                          <p className="font-medium text-slate-900">{client.full_name}</p>
                          <p className="text-sm text-slate-600">{client.date_of_birth ? `DOB ${client.date_of_birth}` : "Date of birth not recorded"}</p>
                        </div>
                        <ArrowRight className="h-5 w-5 text-slate-400" />
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="py-10 text-center text-sm text-slate-500">{query ? "No patient matches that search." : "No patients are available in this organisation."}</div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="resources" className="mt-5 space-y-5">
            <Card className="border-blue-200 bg-blue-50/70">
              <CardContent className="flex flex-col justify-between gap-4 pt-6 sm:flex-row sm:items-center">
                <div>
                  <h2 className="font-semibold text-blue-950">Printable food and symptom diary</h2>
                  <p className="mt-1 text-sm text-blue-900">Collect intake timing, foods, fluids, symptoms and context before review.</p>
                </div>
                <Button onClick={() => setFoodDiaryOpen(true)}><FileText className="mr-2 h-4 w-4" />Open diary</Button>
              </CardContent>
            </Card>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {RESOURCES.map((resource) => (
                <Card key={resource.url} className="border-slate-200 bg-white/95">
                  <CardHeader><CardTitle className="text-base">{resource.title}</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm leading-6 text-slate-600">{resource.description}</p>
                    <Button asChild variant="outline" className="w-full"><a href={resource.url} target="_blank" rel="noreferrer">Open resource<ExternalLink className="ml-2 h-4 w-4" /></a></Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <FoodDiaryTemplate isOpen={foodDiaryOpen} onClose={() => setFoodDiaryOpen(false)} />
      {selectedClient && (
        <>
          <NutritionPlanViewer
            isOpen={viewerOpen}
            onClose={closePatientTools}
            client={selectedClient}
            onCreateNew={() => { setViewerOpen(false); setCreatorOpen(true); }}
          />
          <NutritionPlanCreator
            isOpen={creatorOpen}
            onClose={closePatientTools}
            client={selectedClient}
            onSuccess={() => { setCreatorOpen(false); setViewerOpen(true); }}
          />
        </>
      )}
    </div>
  );
}
