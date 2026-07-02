import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Utensils, 
  ExternalLink, 
  Calculator, 
  AlertTriangle,
  Search,
  UserPlus,
  ArrowRight,
  FileText
} from "lucide-react";
import { createPageUrl } from "@/utils";
import { Toaster, toast } from "sonner";
import FoodDiaryTemplate from "../components/nutrition/FoodDiaryTemplate";
import NutritionPlanCreator from "../components/client/NutritionPlanCreator";
import NutritionPlanViewer from "../components/client/NutritionPlanViewer";

export default function NutritionPage() {
  const navigate = useNavigate();
  const [clients, setClients] = useState([]);
  const [userOrgId, setUserOrgId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [showFoodDiary, setShowFoodDiary] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [showNutritionPlan, setShowNutritionPlan] = useState(false);
  const [showPlanViewer, setShowPlanViewer] = useState(false);

  useEffect(() => { fetchCurrentUserOrg(); }, []);
  useEffect(() => { if (userOrgId) loadClients(); }, [userOrgId]);

  const fetchCurrentUserOrg = async () => {
    try {
      const currentUser = await base44.auth.me();
      const memberships = await base44.entities.OrganizationMember.filter({ user_email: currentUser.email });
      if (memberships.length > 0) {
        const primaryMembership = memberships.find(m => m.is_primary) || memberships[0];
        setUserOrgId(primaryMembership.org_id);
      } else {
        setUserOrgId(null);
        toast.error("You don't belong to any organization.");
      }
    } catch (error) {
      console.error("Error fetching user organization:", error);
      toast.error("Failed to load user organization.");
    }
  };

  const loadClients = async () => {
    setIsLoading(true);
    try {
      if (!userOrgId) { setIsLoading(false); return; }
      const clientData = await base44.entities.Client.filter({ org_id: userOrgId });
      setClients(clientData);
    } catch (error) {
      console.error("Error loading clients:", error);
      toast.error("Failed to load clients");
    } finally {
      setIsLoading(false);
    }
  };

  const filteredClients = clients.filter(client =>
    client.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleClientSelect = async (client) => {
    setSelectedClient(client);
    try {
      const plans = await base44.entities.ClientNutritionPlan.filter({ client_id: client.id });
      if (plans.length > 0) {
        setShowPlanViewer(true);
      } else {
        setShowNutritionPlan(true);
      }
    } catch (error) {
      setShowNutritionPlan(true);
    }
  };

  const ScopeCard = ({ title, icon, within, outside, referTo, links }) => (
    <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className={`w-5 h-5 ${icon}`} />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
          <h4 className="font-semibold text-green-900 mb-3">âœ“ Within Scope</h4>
          <ul className="space-y-2 text-sm text-green-800">
            {within.map((item, i) => <li key={i} className="flex items-start gap-2"><span className="text-green-600 font-bold">â€¢</span><span>{item}</span></li>)}
          </ul>
        </div>
        <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
          <h4 className="font-semibold text-red-900 mb-3">âœ— Outside Scope (Refer to Dietitian)</h4>
          <ul className="space-y-2 text-sm text-red-800">
            {outside.map((item, i) => <li key={i} className="flex items-start gap-2"><span className="text-red-600 font-bold">â€¢</span><span>{item}</span></li>)}
          </ul>
        </div>
        <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
          <p className="text-sm text-blue-800">{referTo}</p>
          {links && (
            <div className="mt-2 flex gap-2 flex-wrap">
              {links.map((l, i) => (
                <button key={i} onClick={() => window.open(l.url, '_blank')} className="text-xs text-blue-700 underline">{l.label}</button>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  const ResourceGrid = ({ resources }) => (
    <div className="grid md:grid-cols-2 gap-4 mt-4">
      {resources.map(r => (
        <Card key={r.title} className="bg-white/80 border-slate-200/60 hover:shadow-md transition-shadow">
          <CardContent className="pt-4">
            <h4 className="font-semibold text-slate-900 mb-1">{r.title}</h4>
            <p className="text-sm text-slate-600 mb-3">{r.desc}</p>
            <Button variant="outline" className="w-full" onClick={() => window.open(r.url, '_blank')}>
              <ExternalLink className="w-4 h-4 mr-2" />{r.label}
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  const SCOPE_DATA = {
    au: {
      title: "Australia â€” Exercise Physiology Nutrition Scope",
      icon: "text-amber-600",
      within: [
        "General healthy eating education aligned with Australian Dietary Guidelines",
        "Portion sizes and daily serves from the Australian Guide to Healthy Eating",
        "Energy balance principles for weight management",
        "General lifestyle recommendations for chronic disease management",
        "Food diary review and education; behaviour change strategies",
        "BMR and TDEE calculations for energy recommendations",
      ],
      outside: [
        "Medical Nutrition Therapy (MNT) â€” prescribing therapeutic diets",
        "Specific macronutrient ratios to treat disease",
        "Interpreting pathology for dietary prescription",
        "Prescribing supplements at therapeutic doses",
        "Meal plans for eating disorders, IBS, renal disease, etc.",
      ],
      referTo: "Key Principle: EPs provide general healthy eating advice. Refer to an Accredited Practising Dietitian (APD) for individualised or therapeutic dietary interventions.",
      links: [{ label: "Australian Dietary Guidelines", url: "https://www.eatforhealth.gov.au/guidelines/guidelines" }, { label: "Find an APD", url: "https://dietitiansaustralia.org.au/find-dietitian" }],
    },
    us: {
      title: "USA â€” Clinical Exercise Physiologist Nutrition Scope",
      icon: "text-blue-600",
      within: [
        "General healthy eating education using MyPlate and Dietary Guidelines for Americans",
        "Macronutrient education in a non-medical/non-disease-treatment context",
        "Hydration guidance for activity and general wellness",
        "Portion guidance and food label reading education",
        "Behaviour change coaching (meal routines, planning, mindful eating)",
      ],
      outside: [
        "Medical Nutrition Therapy (MNT) for diagnosed conditions",
        "Treating or managing disease via individualised diet plans",
        "Prescribing supplements to treat deficiencies or conditions",
        "Diagnosing nutrition-related conditions",
      ],
      referTo: "Refer to: Registered Dietitian Nutritionist (RDN) for all therapeutic nutrition needs. Note: Nutrition practice laws vary by state â€” default to education-only.",
      links: [{ label: "Dietary Guidelines for Americans", url: "https://www.dietaryguidelines.gov" }, { label: "MyPlate Resources", url: "https://www.myplate.gov" }, { label: "Find an RDN", url: "https://www.eatright.org/find-a-nutrition-expert" }],
    },
    uk: {
      title: "UK â€” Clinical Exercise Physiologist Nutrition Scope",
      icon: "text-blue-600",
      within: [
        "General healthy eating education based on the NHS Eatwell Guide",
        "Energy balance education for weight management in exercise context",
        "Hydration and exercise nutrition for non-clinical populations",
        "General behaviour change support for healthy eating habits",
        "Food diary review and general feedback aligned with Eatwell Guide",
        "NICE-aligned lifestyle advice for cardiovascular, diabetes, and obesity prevention",
      ],
      outside: [
        "Therapeutic nutrition or diet therapy for disease management",
        "Individualised meal plans for clinical conditions",
        "Prescribing vitamins, minerals, or supplements at therapeutic doses",
        "Nutritional assessment using MUST beyond EP scope",
      ],
      referTo: "Refer to: Registered Dietitian (RD) â€” protected title regulated by HCPC. In UK, 'nutritionist' is not a protected title.",
      links: [{ label: "NHS Eatwell Guide", url: "https://www.nhs.uk/live-well/eat-well/food-guidelines-and-food-labels/the-eatwell-guide/" }, { label: "Find a Dietitian (BDA)", url: "https://www.bda.uk.com/find-a-dietitian.html" }],
    },
    ca: {
      title: "Canada â€” Kinesiologist / Exercise Physiologist Nutrition Scope",
      icon: "text-red-600",
      within: [
        "General healthy eating education based on Canada's Food Guide (2019)",
        "Energy balance and physical activity nutrition education",
        "Hydration and exercise fuelling guidance (non-clinical populations)",
        "General behaviour change support for healthy eating aligned with Canada's Food Guide",
        "Food diary review and general education",
      ],
      outside: [
        "Medical nutrition therapy for clinical conditions",
        "Individualised therapeutic meal plans",
        "Prescribing or recommending therapeutic supplements",
        "Nutritional counselling for eating disorders, renal disease, oncology",
      ],
      referTo: "Refer to: Registered Dietitian (RD) â€” regulated in all provinces. Note: Nutrition practice is regulated differently across provinces â€” always check your provincial requirements.",
      links: [{ label: "Canada's Food Guide 2019", url: "https://food-guide.canada.ca/en/" }, { label: "Find a Dietitian (DC)", url: "https://www.dietitians.ca/Find-a-Dietitian" }],
    },
    nz: {
      title: "New Zealand â€” Exercise Physiologist Nutrition Scope",
      icon: "text-teal-600",
      within: [
        "General healthy eating education aligned with NZ Ministry of Health dietary guidelines",
        "Energy balance, portion guidance, and food group education",
        "Hydration and exercise nutrition for non-clinical populations",
        "Culturally responsive nutrition education (MÄori and Pacific health frameworks)",
        "General behaviour change for healthy eating habits",
      ],
      outside: [
        "Medical nutrition therapy for clinical conditions",
        "Individualised therapeutic meal plans",
        "Prescribing therapeutic supplements",
      ],
      referTo: "Refer to: Registered Dietitian (RD) â€” regulated by Dietitians New Zealand. NZRD is the recognised credential.",
      links: [{ label: "NZ Healthy Eating Guidelines", url: "https://www.health.govt.nz/your-health/healthy-living/food-activity-and-sleep/healthy-eating" }, { label: "Find a Dietitian (NZ)", url: "https://dietitians.org.nz/find-a-dietitian/" }],
    },
    sg: {
      title: "Singapore â€” Exercise Physiologist Nutrition Scope",
      icon: "text-red-600",
      within: [
        "General healthy eating education aligned with HPB My Healthy Plate guidelines",
        "Energy balance education in context of chronic disease prevention programmes (Healthier SG)",
        "Healthier Dining Programme food choice guidance",
        "General hydration and exercise nutrition education",
        "Food diary review and general behaviour change support",
      ],
      outside: [
        "Medical nutrition therapy for CDMP chronic disease management",
        "Therapeutic meal plans for diabetes (MNT), renal disease, oncology",
        "Prescribing therapeutic supplements",
      ],
      referTo: "Refer to: Registered Dietitian (SNDA â€” Singapore Nutrition and Dietetics Association). Dietetics is an AHPC-regulated allied health profession in Singapore.",
      links: [{ label: "HPB My Healthy Plate", url: "https://www.hpb.gov.sg/healthy-living/food-beverage/eat-more-wholegrains/my-healthy-plate" }, { label: "Find a Dietitian (SNDA)", url: "https://snda.org.sg/accreditations/dietitians" }],
    },
    ie: {
      title: "Ireland â€” Exercise Physiologist Nutrition Scope",
      icon: "text-green-600",
      within: [
        "General healthy eating education aligned with Healthy Ireland / FSAI Food Pyramid",
        "Energy balance and portion guidance",
        "Hydration and exercise nutrition for non-clinical populations",
        "General behaviour change support for healthy eating habits aligned with HSE guidelines",
        "Food diary review and education",
      ],
      outside: [
        "Medical nutrition therapy for clinical conditions",
        "Individualised therapeutic meal plans",
        "Prescribing therapeutic supplements",
      ],
      referTo: "Refer to: Registered Dietitian â€” regulated by CORU in Ireland. 'Dietitian' is a protected title. INDI is the professional body.",
      links: [{ label: "FSAI Healthy Eating Guidelines", url: "https://www.fsai.ie/publications/healthy-eating-food-safety-and-food-legislation" }, { label: "Find a Dietitian (INDI)", url: "https://www.indi.ie/find-a-dietitian.html" }],
    },
    za: {
      title: "South Africa â€” Biokineticist Nutrition Scope",
      icon: "text-green-700",
      within: [
        "General healthy eating education aligned with SAMRC / DoH South African food-based dietary guidelines",
        "Energy balance principles for weight management in exercise context",
        "Hydration and general exercise nutrition education",
        "General behaviour change support for healthy eating",
        "Food diary review and general feedback aligned with national guidelines",
      ],
      outside: [
        "Medical nutrition therapy for clinical conditions",
        "Therapeutic meal plans for diabetes, renal disease, oncology, HIV/AIDS",
        "Prescribing therapeutic supplements",
      ],
      referTo: "Refer to: Registered Dietitian â€” regulated by HPCSA (Dietetics and Human Nutrition board). ADSA is the professional body.",
      links: [{ label: "Find a Dietitian (ADSA)", url: "https://adsa.org.za/find-a-registered-dietitian/" }, { label: "HPCSA Register", url: "https://www.hpcsa.co.za" }],
    },
  };

  const RESOURCE_DATA = {
    au: [
      { title: "Australian Dietary Guidelines", desc: "Official NHMRC guidelines for healthy eating across all life stages.", url: "https://www.eatforhealth.gov.au/guidelines/guidelines", label: "View Guidelines" },
      { title: "Australian Guide to Healthy Eating", desc: "Visual food group plate with recommended daily serves.", url: "https://www.eatforhealth.gov.au/guidelines/australian-guide-healthy-eating", label: "View AGHE" },
      { title: "Eat For Health (NHMRC)", desc: "Comprehensive nutrition info and resources for health professionals.", url: "https://www.eatforhealth.gov.au/", label: "Visit Website" },
      { title: "Dietitians Australia â€” Find an APD", desc: "Refer clients needing Medical Nutrition Therapy to an Accredited Practising Dietitian.", url: "https://dietitiansaustralia.org.au/find-dietitian", label: "Find an APD" },
      { title: "Sports Dietitians Australia", desc: "Find a sports dietitian for performance nutrition referrals.", url: "https://sportsdietitians.com.au/find-an-accredited-sports-dietitian", label: "Find an SDA" },
      { title: "Nutrient Reference Values", desc: "Australian and NZ NRVs â€” RDIs, AIs, EARs and ULs for all nutrients.", url: "https://www.eatforhealth.gov.au/nutrient-reference-values", label: "View NRVs" },
    ],
    us: [
      { title: "Dietary Guidelines for Americans 2020â€“2025", desc: "Official USDA + HHS guidelines.", url: "https://www.dietaryguidelines.gov/resources/2020-2025-dietary-guidelines-online-materials", label: "View Guidelines" },
      { title: "USDA MyPlate", desc: "Visual plate guide with tools, tip sheets, and education resources.", url: "https://www.myplate.gov/resources", label: "Visit MyPlate" },
      { title: "Dietary Reference Intakes (DRIs)", desc: "National Academies nutrient reference standards â€” RDA/AI/EAR/UL.", url: "https://www.ncbi.nlm.nih.gov/books/NBK45182/", label: "View DRIs" },
      { title: "Academy of Nutrition and Dietetics", desc: "Find an RDN for client referrals requiring Medical Nutrition Therapy.", url: "https://www.eatright.org/find-a-nutrition-expert", label: "Find an RDN" },
      { title: "Commission on Dietetic Registration", desc: "State licensure info and RDN scope of practice resources.", url: "https://www.cdrnet.org/licensure", label: "State Licensure" },
      { title: "NIH Office of Dietary Supplements", desc: "Evidence-based fact sheets on vitamins, minerals, and supplements.", url: "https://ods.od.nih.gov/factsheets/list-all/", label: "View Fact Sheets" },
    ],
    uk: [
      { title: "UK Eatwell Guide", desc: "NHS/PHE visual guide to proportions of food groups for a healthy diet.", url: "https://www.nhs.uk/live-well/eat-well/food-guidelines-and-food-labels/the-eatwell-guide/", label: "View Eatwell Guide" },
      { title: "SACN Dietary Reference Values", desc: "Scientific Advisory Committee on Nutrition â€” nutrient reference values for the UK.", url: "https://www.gov.uk/government/publications/sacn-dietary-reference-values-for-energy", label: "View DRVs" },
      { title: "British Dietetic Association", desc: "Find a Registered Dietitian for client referrals.", url: "https://www.bda.uk.com/find-a-dietitian.html", label: "Find an RD" },
      { title: "NHS Healthy Eating", desc: "Patient-facing healthy eating advice aligned with UK guidelines.", url: "https://www.nhs.uk/live-well/eat-well/", label: "NHS Eat Well" },
      { title: "PHE Nutrient Profiling Model", desc: "UK nutrient profiling tool used for food labelling and marketing policy.", url: "https://www.gov.uk/government/publications/the-nutrient-profiling-model", label: "View Model" },
      { title: "HCPC Register â€” Dietitians", desc: "Verify a dietitian's HCPC registration status in the UK.", url: "https://www.hcpc-uk.org/check-the-register/", label: "Check Register" },
    ],
    ca: [
      { title: "Canada's Food Guide 2019", desc: "Federal dietary guidelines emphasising plant-based foods, water, and mindful eating.", url: "https://food-guide.canada.ca/en/", label: "View Food Guide" },
      { title: "Dietary Reference Intakes (Health Canada)", desc: "Canadian DRI tables for all nutrients.", url: "https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/dietary-reference-intakes.html", label: "View DRIs" },
      { title: "Dietitians of Canada", desc: "Find a Registered Dietitian for client referrals.", url: "https://www.dietitians.ca/Find-a-Dietitian", label: "Find an RD" },
      { title: "Canadian Society for Exercise Physiology", desc: "CSEP professional resources and position statements.", url: "https://csep.ca/", label: "Visit CSEP" },
      { title: "Health Canada â€” Nutrition", desc: "Federal nutrition policy, labelling regulations, and healthy eating resources.", url: "https://www.canada.ca/en/health-canada/services/food-nutrition.html", label: "Health Canada" },
      { title: "Canada's Food Guide â€” Professional Resources", desc: "Educator guides, handouts, and visual assets from Health Canada.", url: "https://food-guide.canada.ca/en/resources/", label: "Download Resources" },
    ],
    nz: [
      { title: "NZ Ministry of Health â€” Healthy Eating", desc: "Official healthy eating guidelines including resources for MÄori and Pacific populations.", url: "https://www.health.govt.nz/your-health/healthy-living/food-activity-and-sleep/healthy-eating", label: "View Guidelines" },
      { title: "Eating and Activity Guidelines 2020", desc: "Full NZ dietary guidelines for adults.", url: "https://www.health.govt.nz/publication/eating-and-activity-guidelines-new-zealand-adults", label: "View Guidelines" },
      { title: "Dietitians New Zealand", desc: "Find an NZRD for referrals.", url: "https://dietitians.org.nz/find-a-dietitian/", label: "Find an NZRD" },
      { title: "New Zealand Nutrition Foundation", desc: "Nutrition education and resources for health professionals and the public.", url: "https://www.nutritionfoundation.org.nz/", label: "Visit NZNF" },
      { title: "NZ Nutrient Reference Values", desc: "Australia/NZ joint NRV tables â€” RDIs, AIs, EARs, and ULs.", url: "https://www.eatforhealth.gov.au/nutrient-reference-values", label: "View NRVs" },
      { title: "Heart Foundation NZ", desc: "Cardiovascular nutrition guidelines and healthy eating resources.", url: "https://www.heartfoundation.org.nz/wellbeing/healthy-eating", label: "Heart Foundation" },
    ],
    sg: [
      { title: "HPB My Healthy Plate", desc: "Singapore's visual dietary guide.", url: "https://www.hpb.gov.sg/healthy-living/food-beverage/eat-more-wholegrains/my-healthy-plate", label: "View My Healthy Plate" },
      { title: "Healthier SG Dietary Guidelines", desc: "National preventive health programme guidelines.", url: "https://www.healthiersg.gov.sg/", label: "Healthier SG" },
      { title: "Singapore Nutrition and Dietetics Association", desc: "Find a Registered Dietitian (SNDA) for MNT referrals.", url: "https://snda.org.sg/accreditations/dietitians", label: "Find an RD (SNDA)" },
      { title: "HPB Dietary Guidelines for Adults", desc: "Evidence-based dietary guidelines from the Health Promotion Board.", url: "https://www.healthhub.sg/well-being-and-lifestyle/food-diet-and-nutrition/dietary_guidelines_adults", label: "View Guidelines" },
      { title: "Healthhub.sg Nutrition", desc: "Consumer-facing nutrition tools, calculators, and educational resources.", url: "https://www.healthhub.sg/programmes/nutrition-hub", label: "Visit Healthhub" },
      { title: "Nutri-Grade Labelling", desc: "Singapore's mandatory front-of-pack nutrient grading system for beverages.", url: "https://www.hpb.gov.sg/food-beverage/nutri-grade", label: "Learn About Nutri-Grade" },
    ],
    ie: [
      { title: "FSAI Healthy Eating Guidelines", desc: "Food Safety Authority of Ireland's healthy eating guide and food pyramid.", url: "https://www.fsai.ie/publications/healthy-eating-food-safety-and-food-legislation", label: "View Guidelines" },
      { title: "Healthy Ireland â€” Healthy Eating", desc: "HSE healthy eating guidelines, food diary tools, and patient resources.", url: "https://www2.hse.ie/healthy-you/food-and-nutrition/healthy-eating/", label: "HSE Nutrition" },
      { title: "Irish Nutrition and Dietetic Institute", desc: "Find an INDI-registered dietitian for MNT referrals.", url: "https://www.indi.ie/find-a-dietitian.html", label: "Find a Dietitian (INDI)" },
      { title: "CORU â€” Dietitians Registration", desc: "Verify dietitian registration with Ireland's CORU.", url: "https://coru.ie/public-protection/check-the-register/", label: "Check CORU Register" },
      { title: "Safefood", desc: "All-island food safety and nutrition agency â€” recipes, guides, and professional resources.", url: "https://www.safefood.net/", label: "Safefood Resources" },
      { title: "FSAI Nutrition Labelling", desc: "EU nutrition labelling regulations and guidance relevant to Irish practice.", url: "https://www.fsai.ie/business-advice/labelling/nutrition-labelling", label: "Labelling Guide" },
    ],
    za: [
      { title: "South African Food-Based Dietary Guidelines", desc: "DOH guidelines adapted for the South African context.", url: "https://www.health.gov.za/wp-content/uploads/2020/11/foodguidelines2004.pdf", label: "View Guidelines" },
      { title: "Association for Dietetics in South Africa", desc: "Find a Registered Dietitian (RD) for MNT referrals.", url: "https://adsa.org.za/find-a-registered-dietitian/", label: "Find an RD (ADSA)" },
      { title: "HPCSA â€” Dietetics Board", desc: "Verify dietitian registration with the Health Professions Council of South Africa.", url: "https://www.hpcsa.co.za", label: "Check HPCSA Register" },
      { title: "South African Sports Medicine Association", desc: "SASMA professional resources including sports nutrition position stands.", url: "https://www.sasma.org.za/", label: "SASMA Resources" },
      { title: "Nutrition Society of South Africa", desc: "NSSA scientific resources, publications, and professional nutrition education.", url: "https://www.nutritionsociety.co.za/", label: "Visit NSSA" },
      { title: "Discovery Vitality Nutrition Tools", desc: "Widely-used SA health incentive programme with evidence-based nutrition resources.", url: "https://www.discovery.co.za/vitality/healthy-eating", label: "Vitality Nutrition" },
    ],
  };

  const COUNTRY_FLAGS = { au: "ðŸ‡¦ðŸ‡º Australia", us: "ðŸ‡ºðŸ‡¸ USA", uk: "ðŸ‡¬ðŸ‡§ UK", ca: "ðŸ‡¨ðŸ‡¦ Canada", nz: "ðŸ‡³ðŸ‡¿ New Zealand", sg: "ðŸ‡¸ðŸ‡¬ Singapore", ie: "ðŸ‡®ðŸ‡ª Ireland", za: "ðŸ‡¿ðŸ‡¦ South Africa" };

  return (
    <>
      <Toaster position="top-center" richColors />
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30 p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 mb-2 flex items-center gap-3">
                <Utensils className="w-8 h-8 text-green-600" />
                Nutrition Hub
              </h1>
              <p className="text-slate-600">Evidence-based nutrition resources within Exercise Physiology scope</p>
            </div>
          </div>

          <Tabs defaultValue="scope" className="w-full">
            <TabsList className="grid w-full grid-cols-3 h-auto p-1.5 bg-slate-100 gap-1.5 mb-2">
              <TabsTrigger value="scope" className="py-2.5 px-3 rounded-lg text-sm font-medium transition-all data-[state=active]:bg-green-600 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-green-50 data-[state=inactive]:hover:text-green-700">EP Scope</TabsTrigger>
              <TabsTrigger value="resources" className="py-2.5 px-3 rounded-lg text-sm font-medium transition-all data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-blue-50 data-[state=inactive]:hover:text-blue-700">Resources</TabsTrigger>
              <TabsTrigger value="clients" className="py-2.5 px-3 rounded-lg text-sm font-medium transition-all data-[state=active]:bg-orange-500 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=inactive]:text-slate-600 data-[state=inactive]:hover:bg-orange-50 data-[state=inactive]:hover:text-orange-600">Client Plans</TabsTrigger>
            </TabsList>

            {/* EP Scope Tab */}
            <TabsContent value="scope" className="space-y-6">
              <Tabs defaultValue="au" className="w-full">
                <TabsList className="flex flex-wrap gap-1 h-auto p-1">
                  {Object.entries(COUNTRY_FLAGS).map(([key, label]) => (
                    <TabsTrigger key={key} value={key}>{label}</TabsTrigger>
                  ))}
                </TabsList>
                {Object.entries(SCOPE_DATA).map(([key, data]) => (
                  <TabsContent key={key} value={key} className="mt-4">
                    <ScopeCard {...data} />
                  </TabsContent>
                ))}
              </Tabs>
            </TabsContent>

            {/* Resources Tab */}
            <TabsContent value="resources" className="space-y-6">
              <div className="grid md:grid-cols-2 gap-4">
                <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <FileText className="w-5 h-5 text-green-600" />Printable Food Diary
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-slate-700 mb-4">Provide clients with a printable 24-hour food diary to gather baseline dietary information.</p>
                    <Button onClick={() => setShowFoodDiary(true)} className="w-full bg-green-600 hover:bg-green-700">
                      <FileText className="w-4 h-4 mr-2" />Open Food Diary Template
                    </Button>
                  </CardContent>
                </Card>
                <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Calculator className="w-5 h-5 text-blue-600" />Energy Calculations
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <h4 className="font-semibold text-slate-900 text-sm mb-1">BMR â€” Mifflin-St Jeor</h4>
                      <div className="bg-slate-50 p-2 rounded text-xs font-mono">
                        <p><strong>Men:</strong> (10Ã—wt) + (6.25Ã—ht) âˆ’ (5Ã—age) + 5</p>
                        <p><strong>Women:</strong> (10Ã—wt) + (6.25Ã—ht) âˆ’ (5Ã—age) âˆ’ 161</p>
                        <p className="text-slate-400 mt-1">wt=kg, ht=cm</p>
                      </div>
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-900 text-sm mb-1">TDEE Activity Multipliers</h4>
                      <div className="text-xs text-slate-700 space-y-0.5">
                        <p>â€¢ Sedentary: Ã— 1.2 &nbsp;â€¢ Light (1-3/wk): Ã— 1.375</p>
                        <p>â€¢ Moderate (3-5/wk): Ã— 1.55 &nbsp;â€¢ Very active: Ã— 1.725</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Tabs defaultValue="au" className="w-full">
                <TabsList className="flex flex-wrap gap-1 h-auto p-1">
                  {Object.entries(COUNTRY_FLAGS).map(([key, label]) => (
                    <TabsTrigger key={key} value={key}>{label}</TabsTrigger>
                  ))}
                </TabsList>
                {Object.entries(RESOURCE_DATA).map(([key, resources]) => (
                  <TabsContent key={key} value={key}>
                    <ResourceGrid resources={resources} />
                  </TabsContent>
                ))}
              </Tabs>
            </TabsContent>

            {/* Client Plans Tab */}
            <TabsContent value="clients" className="space-y-6">
              <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <UserPlus className="w-5 h-5 text-blue-600" />Create or View Client Nutrition Plans
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-slate-700 mb-2 block">Search for a client</label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input placeholder="Search by name..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
                      </div>
                    </div>
                    {isLoading ? (
                      <div className="text-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                        <p className="text-slate-600 mt-2">Loading clients...</p>
                      </div>
                    ) : filteredClients.length > 0 ? (
                      <div className="space-y-2 max-h-96 overflow-y-auto">
                        {filteredClients.slice(0, 20).map((client) => (
                          <button key={client.id} onClick={() => handleClientSelect(client)} className="w-full p-4 bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 rounded-lg text-left transition-all flex items-center justify-between group">
                            <div>
                              <p className="font-medium text-slate-900">{client.full_name}</p>
                              <p className="text-sm text-slate-600">
                                {client.date_of_birth ? `Age ${new Date().getFullYear() - new Date(client.date_of_birth).getFullYear()}` : 'No DOB'}
                              </p>
                            </div>
                            <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-blue-600 transition-colors" />
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <p className="text-slate-500">{searchTerm ? 'No clients found matching your search' : 'No clients available'}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <FoodDiaryTemplate isOpen={showFoodDiary} onClose={() => setShowFoodDiary(false)} />

      {selectedClient && (
        <>
          <NutritionPlanViewer
            isOpen={showPlanViewer}
            onClose={() => { setShowPlanViewer(false); setSelectedClient(null); }}
            client={selectedClient}
            onCreateNew={() => { setShowPlanViewer(false); setShowNutritionPlan(true); }}
          />
          <NutritionPlanCreator
            isOpen={showNutritionPlan}
            onClose={() => { setShowNutritionPlan(false); setSelectedClient(null); }}
            client={selectedClient}
            onSuccess={() => { loadClients(); setShowNutritionPlan(false); setShowPlanViewer(true); }}
          />
        </>
      )}
    </>
  );
}