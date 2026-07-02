import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from 'recharts';
import { 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  Target,
  Calendar,
  Minus,
  AlertCircle,
  Award,
  Loader2,
  Download,
  Filter,
  ClipboardList
} from 'lucide-react';
import { format, parseISO, differenceInWeeks, subDays, subMonths, subYears, isAfter } from 'date-fns';
import { toast } from 'sonner';
import html2canvas from 'html2canvas';

export default function ProgressVisualization({ client, conditions }) {
  const [isLoading, setIsLoading] = useState(true);
  const [assessmentData, setAssessmentData] = useState([]);
  const [fullAssessmentData, setFullAssessmentData] = useState([]);
  const [validAssessments, setValidAssessments] = useState([]);
  const [allAssessments, setAllAssessments] = useState([]);
  const [sessionData, setSessionData] = useState([]);
  const [painData, setPainData] = useState([]);
  const [progressMetrics, setProgressMetrics] = useState(null);
  const [radarData, setRadarData] = useState([]);
  const [timePeriod, setTimePeriod] = useState('all');
  const [chartStyle, setChartStyle] = useState('line');
  const chartRef = useRef(null);
  const [expandedGroups, setExpandedGroups] = useState({});
  const [selectedAssessments, setSelectedAssessments] = useState(new Set());
  const [assessmentHistory, setAssessmentHistory] = useState({});

  const parseDate = (dateString) => {
    if (!dateString) return null;
    let date = new Date(dateString);
    if (!isNaN(date.getTime())) {
      return date;
    }
    const parts = dateString.split('/');
    if (parts.length === 3) {
      date = new Date(`${parts[1]}/${parts[0]}/${parts[2]}`);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }
    return null;
  };

  useEffect(() => {
    if (client) {
      loadProgressData();
    }
  }, [client?.id]);

  useEffect(() => {
    filterDataByPeriod();
  }, [timePeriod, fullAssessmentData]);

  const filterDataByPeriod = () => {
    if (!fullAssessmentData.length) return;

    let cutoffDate;
    const now = new Date();

    switch (timePeriod) {
      case '1week':
        cutoffDate = subDays(now, 7);
        break;
      case '1month':
        cutoffDate = subMonths(now, 1);
        break;
      case '3months':
        cutoffDate = subMonths(now, 3);
        break;
      case '6months':
        cutoffDate = subMonths(now, 6);
        break;
      case '1year':
        cutoffDate = subYears(now, 1);
        break;
      case 'all':
      default:
        setAssessmentData(fullAssessmentData);
        return;
    }

    const filtered = fullAssessmentData.filter(item => {
      const itemDate = parseDate(item.date);
      if (!itemDate) return false;
      return isAfter(itemDate, cutoffDate);
    });

    setAssessmentData(filtered);
  };

  const handleDownloadChart = async () => {
    if (!chartRef.current) {
      toast.error('Chart not available for download');
      return;
    }

    try {
      const canvas = await html2canvas(chartRef.current, {
        backgroundColor: '#ffffff',
        scale: 2
      });
      
      const link = document.createElement('a');
      link.download = `${client.full_name}-progress-chart-${format(new Date(), 'yyyy-MM-dd')}.png`;
      link.href = canvas.toDataURL();
      link.click();
      
      toast.success('Chart downloaded successfully');
    } catch (error) {
      console.error('Error downloading chart:', error);
      toast.error('Failed to download chart');
    }
  };

  const loadProgressData = async () => {
    setIsLoading(true);
    try {
      const [assessments, soapNotes, fetchedAssessments, appointments] = await Promise.all([
        base44.entities.ClientAssessment.filter({ client_id: client.id, status: 'completed' }),
        base44.entities.SOAPNote.filter({ client_id: client.id, status: 'published' }),
        base44.entities.Assessment.list(),
        base44.entities.Appointment.filter({ client_id: client.id, status: 'completed' })
      ]);

      setAllAssessments(fetchedAssessments);

      // Filter out assessments with deleted assessment definitions
      const validAssessmentsData = assessments.filter(ca => {
        const assessment = fetchedAssessments.find(a => a.id === ca.assessment_id);
        return assessment !== undefined;
      });

      setValidAssessments(validAssessmentsData);

      // Process assessment data over time
      const assessmentsByType = {};
      validAssessmentsData.forEach(ca => {
        const assessment = fetchedAssessments.find(a => a.id === ca.assessment_id);
        
        if (!assessmentsByType[assessment.name]) {
          assessmentsByType[assessment.name] = [];
        }
        
        const assessmentDate = parseDate(ca.assessment_date || ca.created_date);
        if (!assessmentDate) {
          console.warn('Skipping assessment with invalid date:', ca.id);
          return;
        }

        assessmentsByType[assessment.name].push({
          date: assessmentDate.toISOString(),
          parsedDate: assessmentDate,
          value: ca.result_value,
          normative: ca.normative_comparison
        });
      });

      // Format for charts
      const chartData = [];
      Object.keys(assessmentsByType).forEach(assessmentName => {
        const sorted = assessmentsByType[assessmentName]
          .filter(item => item.parsedDate)
          .sort((a, b) => a.parsedDate.getTime() - b.parsedDate.getTime());
        
        sorted.forEach((item) => {
          const existing = chartData.find(d => d.date === item.date);
          if (existing) {
            existing[assessmentName] = item.value;
          } else {
            chartData.push({
              date: item.date,
              dateLabel: format(item.parsedDate, 'MMM dd'),
              [assessmentName]: item.value
            });
          }
        });
      });

      const sortedData = chartData.sort((a, b) => new Date(a.date) - new Date(b.date));
      setFullAssessmentData(sortedData);
      setAssessmentData(sortedData);

      // Process session attendance
      const sessionsByWeek = {};
      [...soapNotes, ...appointments].forEach(item => {
        const dateString = item.note_date || item.start_time;
        const date = parseDate(dateString);
        if (!date) {
          console.warn('Skipping session with invalid date:', dateString);
          return;
        }
        
        const weekStart = format(date, 'yyyy-ww');
        sessionsByWeek[weekStart] = (sessionsByWeek[weekStart] || 0) + 1;
      });

      const sessionChart = Object.keys(sessionsByWeek).map(week => ({
        week: week.split('-')[1],
        sessions: sessionsByWeek[week]
      })).slice(-12); // Last 12 weeks

      setSessionData(sessionChart);

      // Process pain levels over time (from conditions)
      const painHistory = [];
      conditions.forEach(condition => {
        if (condition.pain_level !== null && condition.pain_level !== undefined) {
          const dateString = condition.updated_date || condition.created_date;
          const date = parseDate(dateString);
          if (!date) {
            console.warn('Skipping condition with invalid date:', dateString);
            return;
          }
          
          painHistory.push({
            date: date.toISOString(),
            dateLabel: format(date, 'MMM dd'),
            pain: condition.pain_level,
            condition: condition.condition_name
          });
        }
      });
      setPainData(painHistory.sort((a, b) => parseDate(a.date).getTime() - parseDate(b.date).getTime()));

      // Calculate progress metrics
      const metrics = calculateProgressMetrics(assessments, soapNotes, assessmentsByType, fetchedAssessments);
      setProgressMetrics(metrics);

      // Create radar chart data for functional domains
      const radar = createRadarData(assessments, fetchedAssessments);
      setRadarData(radar);

    } catch (error) {
      console.error('Error loading progress data:', error);
      toast.error('Failed to load progress data');
    } finally {
      setIsLoading(false);
    }
  };

  // Comprehensive mapping of assessments where LOWER scores are BETTER
  const lowerIsBetterAssessments = [
    // Pain & Symptom Scales
    'pain', 'vas', 'visual analog', 'numeric pain', 'body pain',
    
    // Mental Health (lower = less distress/symptoms)
    'phq', 'gad', 'dass', 'depression', 'anxiety', 'stress',
    'hospital anxiety', 'hads', 'ies-r', 'impact of event',
    'ptsd checklist', 'pcl-5', 'insomnia severity', 'isi',
    'fatigue severity', 'fss', 'chalders fatigue', 'chalder',
    'depaul symptom', 'dsq',
    
    // Disability & Impairment Indices (lower = less disability)
    'disability', 'oswestry', 'odi', 'roland morris', 'neck disability', 'ndi',
    'dash', 'quickdash', 'womac', 'koos', 'hoos', 'lefs',
    'fibromyalgia impact', 'fiq', 'fiqr',
    'foot and ankle ability', 'faam',
    'american shoulder', 'ases',
    
    // Respiratory Symptom Questionnaires (lower = fewer symptoms)
    'copd assessment', 'cat', 'clinical copd', 'ccq',
    'st george', 'sgrq', 'leicester cough',
    
    // Functional Limitation Scales (lower = less limitation)
    'fear avoidance', 'fabq', 'pain catastrophizing', 'pcs',
    
    // Timed Tests (lower time = better performance)
    'timed up and go', 'tug', '10 meter walk', '10mwt', '10-meter walk',
    '8 foot up', '8-foot up and go', 'ten meter', 'ten metre',
    '6 meter walk', '6mwt', 'figure of eight', 'figure-of-eight',
    'four square', '4 square', 'l test',
    
    // Fall Risk Scales (lower = less risk)
    'conley scale', 'morse fall', 'falls risk',
    
    // Frailty Scales (lower = less frail)
    'clinical frailty', 'edmonton frail', 'efs',
    
    // Neurological Impairment (lower = less impairment)
    'expanded disability status', 'edss', 'modified rankin',
    
    // Psychological Distress (lower = less distress)
    'kessler', 'k10', 'perceived stress', 'pss',
    
    // Body Composition (lower body fat % can indicate better fitness in many contexts)
    'body fat percentage', 'body fat', 'skinfolds',
    
    // Blood Pressure & Cardiovascular Risk (lower resting values often better)
    'resting heart rate', 'systolic', 'diastolic', 'blood pressure',
    
    // Metabolic Markers (lower fasting values often better)
    'fasting blood glucose', 'fasting glucose', 'hba1c',
    
    // Waist measurements (lower = less central adiposity)
    'waist circumference', 'waist-hip ratio', 'waist hip', 'whr'
  ];

  const isLowerBetter = (assessmentName) => {
    const nameLower = assessmentName.toLowerCase();
    return lowerIsBetterAssessments.some(keyword => nameLower.includes(keyword));
  };

  const calculateProgressMetrics = (assessments, soapNotes, assessmentsByType, allAssessments) => {
    const metrics = {
      totalSessions: soapNotes.length,
      totalAssessments: assessments.length,
      improvements: 0,
      declines: 0,
      stable: 0,
      treatmentWeeks: 0,
      assessmentTrends: []
    };

    // Calculate treatment duration
    if (soapNotes.length > 0) {
      const firstSession = parseDate(soapNotes[0].note_date);
      const lastSession = parseDate(soapNotes[soapNotes.length - 1].note_date);
      if (firstSession && lastSession) {
        metrics.treatmentWeeks = differenceInWeeks(lastSession, firstSession);
      }
    }

    // Analyze trends for each assessment type
    Object.keys(assessmentsByType).forEach(assessmentName => {
      const data = assessmentsByType[assessmentName]
        .filter(item => item.parsedDate)
        .sort((a, b) => a.parsedDate.getTime() - b.parsedDate.getTime());

      if (data.length >= 2) {
        const first = data[0].value;
        const last = data[data.length - 1].value;
        const change = last - first;
        const percentChange = ((change / first) * 100).toFixed(1);

        // Determine if higher is better based on comprehensive assessment mapping
        const higherIsBetter = !isLowerBetter(assessmentName);

        let trend = 'stable';
        if (Math.abs(change) > (first * 0.1)) { // More than 10% change
          if (higherIsBetter) {
            trend = change > 0 ? 'improving' : 'declining';
          } else {
            trend = change < 0 ? 'improving' : 'declining';
          }
        }

        if (trend === 'improving') metrics.improvements++;
        else if (trend === 'declining') metrics.declines++;
        else metrics.stable++;

        metrics.assessmentTrends.push({
          name: assessmentName,
          trend,
          change: percentChange,
          firstValue: first,
          lastValue: last
        });
      }
    });

    return metrics;
  };

  const createRadarData = (assessments, allAssessments) => {
    // Group assessments by category
    const categories = {
      'Balance': [],
      'Strength': [],
      'Endurance': [],
      'Function': [],
      'Mobility': [],
      'Mental Health': []
    };

    // Filter out deleted assessments
    const validAssessments = assessments.filter(ca => {
      return allAssessments.find(a => a.id === ca.assessment_id) !== undefined;
    });

    validAssessments.forEach(ca => {
      const assessment = allAssessments.find(a => a.id === ca.assessment_id);

      // Categorize assessments
      const name = assessment.name.toLowerCase();
      if (name.includes('balance') || name.includes('berg')) {
        categories['Balance'].push(ca);
      } else if (name.includes('strength') || name.includes('grip')) {
        categories['Strength'].push(ca);
      } else if (name.includes('walk') || name.includes('endurance') || name.includes('6mw')) {
        categories['Endurance'].push(ca);
      } else if (name.includes('function') || name.includes('dash') || name.includes('oswestry')) {
        categories['Function'].push(ca);
      } else if (name.includes('tug') || name.includes('mobility')) {
        categories['Mobility'].push(ca);
      } else if (name.includes('phq') || name.includes('gad') || name.includes('depression') || name.includes('anxiety')) {
        categories['Mental Health'].push(ca);
      }
    });

    // Calculate average percentile for each category (0-100 scale)
    const radarData = Object.keys(categories).map(category => {
      const categoryAssessments = categories[category];
      if (categoryAssessments.length === 0) return null;

      // Get most recent assessment in this category
      const latest = categoryAssessments
        .map(item => ({ ...item, parsedDate: parseDate(item.assessment_date) }))
        .filter(item => item.parsedDate)
        .sort((a, b) => b.parsedDate.getTime() - a.parsedDate.getTime())[0];
      
      if (!latest) return null;

      // Convert normative comparison to score
      let score = 50; // default average
      if (latest.normative_comparison === 'well_above_average') score = 90;
      else if (latest.normative_comparison === 'above_average') score = 70;
      else if (latest.normative_comparison === 'average') score = 50;
      else if (latest.normative_comparison === 'below_average') score = 30;
      else if (latest.normative_comparison === 'well_below_average') score = 10;

      return {
        category,
        score,
        fullMark: 100
      };
    }).filter(d => d !== null);

    return radarData;
  };

  const getTrendIcon = (trend) => {
    if (trend === 'improving') return <TrendingUp className="w-4 h-4 text-green-600" />;
    if (trend === 'declining') return <TrendingDown className="w-4 h-4 text-red-600" />;
    return <Minus className="w-4 h-4 text-slate-400" />;
  };

  const getTrendColor = (trend) => {
    if (trend === 'improving') return 'text-green-600 bg-green-50';
    if (trend === 'declining') return 'text-red-600 bg-red-50';
    return 'text-slate-600 bg-slate-50';
  };

  const buildAssessmentHistory = () => {
    const history = {};
    validAssessments.forEach(ca => {
      const assessment = allAssessments.find(a => a.id === ca.assessment_id);
      if (!assessment) return;
      
      if (!history[assessment.name]) {
        history[assessment.name] = [];
      }
      
      history[assessment.name].push({
        id: ca.id,
        date: ca.assessment_date || ca.created_date,
        result: ca.result_value,
        unit: assessment.unit_of_measure
      });
    });

    // Sort each assessment's history chronologically
    Object.keys(history).forEach(name => {
      history[name].sort((a, b) => new Date(a.date) - new Date(b.date));
    });

    setAssessmentHistory(history);
    
    // Initialize all groups as expanded
    const expanded = {};
    Object.keys(history).forEach(name => {
      expanded[name] = true;
    });
    setExpandedGroups(expanded);
  };

  useEffect(() => {
    if (validAssessments.length > 0 && allAssessments.length > 0) {
      buildAssessmentHistory();
    }
  }, [validAssessments, allAssessments]);

  const getTrendIndicator = (current, previous, assessmentName) => {
    if (previous === null || previous === undefined) return 'â€”';
    const change = current - previous;
    const isLowerBetterForThis = isLowerBetter(assessmentName);
    
    if (change === 0) return 'â€”';
    if ((isLowerBetterForThis && change < 0) || (!isLowerBetterForThis && change > 0)) {
      return 'â†‘';
    }
    return 'â†“';
  };

  const getTrendIndicatorColor = (indicator) => {
    if (indicator === 'â†‘') return 'text-green-600';
    if (indicator === 'â†“') return 'text-red-600';
    return 'text-slate-400';
  };

  const handleToggleGroup = (assessmentName) => {
    setExpandedGroups(prev => ({
      ...prev,
      [assessmentName]: !prev[assessmentName]
    }));
  };

  const handleToggleAssessment = (assessmentName) => {
    const newSelected = new Set(selectedAssessments);
    if (newSelected.has(assessmentName)) {
      newSelected.delete(assessmentName);
    } else {
      newSelected.add(assessmentName);
    }
    setSelectedAssessments(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedAssessments.size === Object.keys(assessmentHistory).length) {
      setSelectedAssessments(new Set());
    } else {
      setSelectedAssessments(new Set(Object.keys(assessmentHistory)));
    }
  };

  const handlePrintSelected = () => {
    if (selectedAssessments.size === 0) {
      toast.error('Please select at least one assessment');
      return;
    }

    const printWindow = window.open('', '_blank');
    const reportDate = format(new Date(), 'dd MMM yyyy');
    const selectedData = Array.from(selectedAssessments).map(name => {
      const history = assessmentHistory[name] || [];
      return { name, history };
    });

    let html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Assessment History Report</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #333; line-height: 1.5; background: white; }
    .page-wrapper { max-width: 210mm; height: 297mm; margin: 0 auto; padding: 20mm; background: white; }
    .header { margin-bottom: 30px; }
    .client-name { font-size: 24px; font-weight: bold; color: #1a1a1a; margin-bottom: 5px; }
    .report-date { font-size: 12px; color: #666; }
    .section { margin-bottom: 25px; page-break-inside: avoid; }
    .section-title { font-size: 14px; font-weight: bold; color: #0066cc; margin-bottom: 12px; border-bottom: 2px solid #0066cc; padding-bottom: 5px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
    thead { background-color: #f0f0f0; }
    th { padding: 10px; text-align: left; font-weight: 600; font-size: 11px; border-bottom: 1px solid #ccc; }
    td { padding: 8px; font-size: 11px; border-bottom: 1px solid #e0e0e0; }
    tbody tr:nth-child(odd) { background-color: #fafafa; }
    .trend-up { color: #28a745; font-weight: bold; }
    .trend-down { color: #dc3545; font-weight: bold; }
    .trend-stable { color: #999; }
    .footer { margin-top: 40px; font-size: 10px; color: #999; border-top: 1px solid #ddd; padding-top: 15px; }
  </style>
</head>
<body>
  <div class="page-wrapper">
    <div class="header">
      <div class="client-name">${client.full_name || 'Client'}</div>
      <div class="report-date">Assessment History Report â€” ${reportDate}</div>
    </div>
`;

    selectedData.forEach(({ name, history }) => {
      html += `
    <div class="section">
      <div class="section-title">${name}</div>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Result</th>
            <th>Change from Previous</th>
            <th>Trend</th>
          </tr>
        </thead>
        <tbody>
`;

      history.forEach((entry, idx) => {
        const previousResult = idx > 0 ? history[idx - 1].result : null;
        let changeText = 'â€”';
        if (previousResult !== null && previousResult !== undefined && entry.result !== null && entry.result !== undefined) {
          const change = entry.result - previousResult;
          changeText = change > 0 ? `+${change}` : `${change}`;
        }

        const trendIndicator = getTrendIndicator(entry.result, previousResult, name);
        const trendClass = trendIndicator === 'â†‘' ? 'trend-up' : trendIndicator === 'â†“' ? 'trend-down' : 'trend-stable';

        html += `
          <tr>
            <td>${format(new Date(entry.date), 'dd MMM yyyy')}</td>
            <td>${entry.result}${entry.unit ? ' ' + entry.unit : ''}</td>
            <td>${changeText}</td>
            <td class="${trendClass}">${trendIndicator}</td>
          </tr>
`;
      });

      html += `
        </tbody>
      </table>
    </div>
`;
    });

    html += `
    <div class="footer">
      <p>This report was generated from assessment data recorded in the system.</p>
    </div>
  </div>
</body>
</html>
`;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.print();
  };

  if (isLoading) {
    return (
      <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
        <CardContent className="py-12 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-blue-600" />
          <p className="text-slate-500">Loading progress data...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-blue-600" />
          Progress Tracking & Analytics
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Quick Stats */}
        {progressMetrics && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-blue-800">Total Sessions</span>
                <Calendar className="w-4 h-4 text-blue-600" />
              </div>
              <p className="text-2xl font-bold text-blue-900">{progressMetrics.totalSessions}</p>
              <p className="text-xs text-blue-700">{progressMetrics.treatmentWeeks} weeks</p>
            </div>

            <div className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-purple-800">Assessments</span>
                <Target className="w-4 h-4 text-purple-600" />
              </div>
              <p className="text-2xl font-bold text-purple-900">{progressMetrics.totalAssessments}</p>
              <p className="text-xs text-purple-700">Completed</p>
            </div>

            <div className="p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-lg">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-green-800">Improving</span>
                <TrendingUp className="w-4 h-4 text-green-600" />
              </div>
              <p className="text-2xl font-bold text-green-900">{progressMetrics.improvements}</p>
              <p className="text-xs text-green-700">Areas</p>
            </div>

            <div className="p-4 bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-orange-800">Needs Focus</span>
                <AlertCircle className="w-4 h-4 text-orange-600" />
              </div>
              <p className="text-2xl font-bold text-orange-900">{progressMetrics.declines}</p>
              <p className="text-xs text-orange-700">Areas</p>
            </div>
          </div>
        )}

        {/* Tabs for different visualizations */}
        <Tabs defaultValue="assessments" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="assessments">Assessment Progress</TabsTrigger>
            <TabsTrigger value="list">All Assessments</TabsTrigger>
            <TabsTrigger value="sessions">Session Frequency</TabsTrigger>
            <TabsTrigger value="functional">Functional Domains</TabsTrigger>
            <TabsTrigger value="trends">Trends Summary</TabsTrigger>
          </TabsList>

          {/* Assessment Progress Over Time */}
          <TabsContent value="assessments" className="space-y-4">
            {Object.keys(assessmentHistory).length > 0 ? (
              <>
                <div className="flex items-center justify-between gap-4 mb-4">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedAssessments.size === Object.keys(assessmentHistory).length && Object.keys(assessmentHistory).length > 0}
                        onChange={handleSelectAll}
                        className="w-4 h-4 cursor-pointer"
                      />
                      <button
                        onClick={handleSelectAll}
                        className="text-sm font-medium text-slate-600 hover:text-slate-800 cursor-pointer"
                      >
                        {selectedAssessments.size === Object.keys(assessmentHistory).length && Object.keys(assessmentHistory).length > 0
                          ? 'Deselect All'
                          : 'Select All'}
                      </button>
                    </div>

                    <button
                      onClick={() => {
                        const allExpanded = Object.values(expandedGroups).every(v => v);
                        const newState = {};
                        Object.keys(assessmentHistory).forEach(name => {
                          newState[name] = !allExpanded;
                        });
                        setExpandedGroups(newState);
                      }}
                      className="text-sm font-medium text-slate-600 hover:text-slate-800 cursor-pointer"
                    >
                      {Object.values(expandedGroups).every(v => v) ? 'Collapse All' : 'Expand All'}
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    {selectedAssessments.size > 0 && (
                      <Button
                        onClick={handlePrintSelected}
                        variant="default"
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        Print Selected ({selectedAssessments.size})
                      </Button>
                    )}
                  </div>
                </div>

                <div className="space-y-0 border rounded-lg overflow-hidden">
                  {Object.entries(assessmentHistory).map(([assessmentName, history]) => (
                    <div key={assessmentName} className="border-b last:border-b-0">
                      <div
                        onClick={() => handleToggleGroup(assessmentName)}
                        className="w-full flex items-center gap-3 p-4 bg-slate-50 hover:bg-slate-100 cursor-pointer font-semibold text-slate-900"
                      >
                        <input
                          type="checkbox"
                          checked={selectedAssessments.has(assessmentName)}
                          onChange={() => handleToggleAssessment(assessmentName)}
                          onClick={e => e.stopPropagation()}
                          className="w-4 h-4 cursor-pointer"
                        />
                        <span>{expandedGroups[assessmentName] ? 'â–¼' : 'â–¶'}</span>
                        <span className="flex-1">{assessmentName}</span>
                      </div>

                      {expandedGroups[assessmentName] && (
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b bg-slate-50">
                              <th className="p-3 text-left font-medium text-slate-700">Date</th>
                              <th className="p-3 text-left font-medium text-slate-700">Result</th>
                              <th className="p-3 text-left font-medium text-slate-700">Change from Previous</th>
                              <th className="p-3 text-left font-medium text-slate-700">Trend</th>
                            </tr>
                          </thead>
                          <tbody>
                            {history.map((entry, idx) => {
                              const previousResult = idx > 0 ? history[idx - 1].result : null;
                              let changeText = 'â€”';
                              if (previousResult !== null && previousResult !== undefined && entry.result !== null && entry.result !== undefined) {
                                const change = entry.result - previousResult;
                                changeText = change > 0 ? `+${change}` : `${change}`;
                              }

                              const trendIndicator = getTrendIndicator(entry.result, previousResult, assessmentName);
                              const trendColorClass = getTrendIndicatorColor(trendIndicator);
                              const rowBg = idx % 2 === 0 ? 'bg-white' : 'bg-slate-50';

                              return (
                                <tr key={entry.id} className={`border-b ${rowBg}`}>
                                  <td className="p-3 text-slate-700">{format(new Date(entry.date), 'dd MMM yyyy')}</td>
                                  <td className="p-3 text-slate-700">{entry.result}{entry.unit ? ` ${entry.unit}` : ''}</td>
                                  <td className="p-3 text-slate-700">{changeText}</td>
                                  <td className={`p-3 font-semibold ${trendColorClass}`}>{trendIndicator}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      )}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center py-12">
                <Target className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">No completed assessments yet</p>
                <p className="text-sm text-slate-400">Complete assessments to track progress</p>
              </div>
            )}
          </TabsContent>

          {/* All Assessments List */}
          <TabsContent value="list" className="space-y-4">
            {validAssessments.length > 0 ? (
              <div className="space-y-2">
                {validAssessments
                  .sort((a, b) => new Date(b.assessment_date || b.created_date) - new Date(a.assessment_date || a.created_date))
                  .map((ca, index) => {
                    const assessment = allAssessments.find(a => a.id === ca.assessment_id);
                    if (!assessment) return null;
                    
                    return (
                      <div key={ca.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50">
                        <div className="flex items-center gap-4 flex-1">
                          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-semibold text-sm">
                            {validAssessments.length - index}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold text-slate-900">{assessment.name}</h4>
                              {ca.source === 'uploaded' && (
                                <Badge variant="outline" className="bg-purple-50 border-purple-300 text-purple-700 text-xs">
                                  Uploaded
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-slate-600">
                              {parseDate(ca.assessment_date || ca.created_date) 
                                ? format(parseDate(ca.assessment_date || ca.created_date), 'PPP') 
                                : 'N/A'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="text-2xl font-bold text-blue-600">
                              {ca.result_value}
                            </p>
                            <p className="text-xs text-slate-500">
                              {assessment.unit_of_measure || 'score'}
                            </p>
                          </div>
                          {ca.normative_comparison && (
                            <Badge variant="outline" className="text-xs">
                              {ca.normative_comparison.replace(/_/g, ' ')}
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            ) : (
              <div className="text-center py-12">
                <ClipboardList className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">No assessments recorded yet</p>
              </div>
            )}
          </TabsContent>

          {/* Session Frequency */}
          <TabsContent value="sessions" className="space-y-4">
            {sessionData.length > 0 ? (
              <>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={sessionData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="week" 
                        label={{ value: 'Week Number', position: 'insideBottom', offset: -5 }}
                        style={{ fontSize: '12px' }}
                      />
                      <YAxis 
                        label={{ value: 'Sessions', angle: -90, position: 'insideLeft' }}
                        style={{ fontSize: '12px' }}
                      />
                      <Tooltip />
                      <Bar dataKey="sessions" fill="#3b82f6" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-sm text-slate-600 text-center">
                  Session attendance frequency over the last 12 weeks
                </p>
              </>
            ) : (
              <div className="text-center py-12">
                <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">No session data available</p>
              </div>
            )}
          </TabsContent>

          {/* Functional Domains Radar */}
          <TabsContent value="functional" className="space-y-4">
            {radarData.length > 0 ? (
              <>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={radarData}>
                      <PolarGrid />
                      <PolarAngleAxis dataKey="category" style={{ fontSize: '12px' }} />
                      <PolarRadiusAxis angle={90} domain={[0, 100]} />
                      <Radar 
                        name="Current Performance" 
                        dataKey="score" 
                        stroke="#3b82f6" 
                        fill="#3b82f6" 
                        fillOpacity={0.6} 
                      />
                      <Tooltip />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-sm text-slate-600 text-center">
                  Functional performance across different domains (based on most recent assessments)
                </p>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                    <span>0-30: Below Average</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                    <span>30-70: Average</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span>70-100: Above Average</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-12">
                <Award className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">No functional domain data yet</p>
                <p className="text-sm text-slate-400">Complete various assessments to see functional profile</p>
              </div>
            )}
          </TabsContent>

          {/* Trends Summary */}
          <TabsContent value="trends" className="space-y-4">
            {progressMetrics?.assessmentTrends.length > 0 ? (
              <div className="space-y-3">
                {progressMetrics.assessmentTrends.map((trend, index) => (
                  <div key={index} className={`p-4 rounded-lg border-2 ${getTrendColor(trend.trend)}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {getTrendIcon(trend.trend)}
                        <h4 className="font-semibold">{trend.name}</h4>
                      </div>
                      <Badge variant={trend.trend === 'improving' ? 'default' : 'secondary'}>
                        {trend.change > 0 ? '+' : ''}{trend.change}%
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span>Initial: <strong>{trend.firstValue}</strong></span>
                      <span>â†’</span>
                      <span>Latest: <strong>{trend.lastValue}</strong></span>
                    </div>
                    <p className="text-xs mt-2 capitalize">
                      Status: <strong>{trend.trend}</strong>
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Activity className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">No trend data available yet</p>
                <p className="text-sm text-slate-400">Complete multiple assessments to track trends</p>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Client Goals Section */}
        {client.client_goals && (
          <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h4 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
              <Target className="w-4 h-4" />
              Client Goals
            </h4>
            <p className="text-sm text-blue-800 whitespace-pre-line">{client.client_goals}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}