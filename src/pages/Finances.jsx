
import React, { useState, useEffect } from "react";
import { User } from "@/entities/User";
import { Appointment, Payment, Client, OrganizationMember } from "@/entities/all";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  DollarSign,
  TrendingUp,
  FileText,
  Download,
  Calendar,
  PieChart,
  BarChart3,
  Loader2,
  CreditCard,
  AlertCircle,
  CheckCircle2,
  Clock
} from "lucide-react";
import moment from "moment";
import { toast } from "sonner";
// Removed jspdf and jspdf-autotable imports

export default function Finances() {
  const [isLoading, setIsLoading] = useState(true);
  const [appointments, setAppointments] = useState([]);
  const [payments, setPayments] = useState([]);
  const [clients, setClients] = useState([]);
  
  // Filter states
  const [dateRange, setDateRange] = useState("current_month");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [fundingFilter, setFundingFilter] = useState("all");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("all");

  // Summary states
  const [financialSummary, setFinancialSummary] = useState({
    totalRevenue: 0,
    totalPaid: 0,
    totalOutstanding: 0,
    totalRefunded: 0,
    appointmentCount: 0,
    paymentCount: 0
  });

  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    loadFinancialData();
  }, []);

  useEffect(() => {
    calculateFinancialSummary();
  }, [appointments, payments, dateRange, startDate, endDate, fundingFilter, paymentStatusFilter]);

  const loadFinancialData = async () => {
    setIsLoading(true);
    try {
      const user = await User.me();
      setCurrentUser(user);

      // Organisation-scoped, not creator-scoped: in a multi-clinician
      // organisation every clinician sees the organisation's finances
      // (previously filtered by created_by, hiding colleagues' records).
      const memberships = await OrganizationMember.filter({ user_email: user.email });
      const primaryOrgId = (memberships.find(m => m.is_primary) || memberships[0])?.org_id;
      if (!primaryOrgId) {
        toast.error("No organisation found for your account.");
        setAppointments([]);
        setPayments([]);
        setClients([]);
        return;
      }

      const [appointmentsData, paymentsData, clientsData] = await Promise.all([
        Appointment.filter({ org_id: primaryOrgId }),
        Payment.filter({ org_id: primaryOrgId }),
        Client.filter({ org_id: primaryOrgId })
      ]);

      // Keep payments joined to the organisation's appointments.
      const userAppointmentIds = new Set(appointmentsData.map(apt => apt.id));
      const userPayments = paymentsData.filter(payment =>
        userAppointmentIds.has(payment.appointment_id)
      );

      setAppointments(appointmentsData);
      setPayments(userPayments);
      setClients(clientsData);
    } catch (error) {
      console.error("Failed to load financial data:", error);
      toast.error("Failed to load financial data.");
    } finally {
      setIsLoading(false);
    }
  };

  const getDateRangeFilter = () => {
    const now = moment();
    
    switch (dateRange) {
      case "current_month":
        return {
          start: now.clone().startOf('month'),
          end: now.clone().endOf('month')
        };
      case "last_month":
        return {
          start: now.clone().subtract(1, 'month').startOf('month'),
          end: now.clone().subtract(1, 'month').endOf('month')
        };
      case "current_quarter":
        return {
          start: now.clone().startOf('quarter'),
          end: now.clone().endOf('quarter')
        };
      case "current_year":
        return {
          start: now.clone().startOf('year'),
          end: now.clone().endOf('year')
        };
      case "last_year":
        return {
          start: now.clone().subtract(1, 'year').startOf('year'),
          end: now.clone().subtract(1, 'year').endOf('year')
        };
      case "custom":
        return {
          start: startDate ? moment(startDate) : now.clone().subtract(1, 'year'),
          end: endDate ? moment(endDate) : now
        };
      default:
        return {
          start: now.clone().subtract(1, 'year'),
          end: now
        };
    }
  };

  const calculateFinancialSummary = () => {
    const dateFilter = getDateRangeFilter();
    
    const filteredAppointments = appointments.filter(apt => {
      const aptDate = moment(apt.start_time);
      const dateMatch = aptDate.isBetween(dateFilter.start, dateFilter.end, 'day', '[]');
      
      if (!dateMatch) return false;
      
      if (fundingFilter !== "all") {
        const client = clients.find(c => c.id === apt.client_id);
        if (!client || client.funding_source !== fundingFilter) return false;
      }
      
      if (paymentStatusFilter !== "all" && apt.payment_status !== paymentStatusFilter) {
        return false;
      }
      
      return true;
    });

    const filteredPayments = payments.filter(payment => {
      const paymentDate = moment(payment.payment_date);
      const dateMatch = paymentDate.isBetween(dateFilter.start, dateFilter.end, 'day', '[]');
      
      if (!dateMatch) return false;
      
      // Check if payment belongs to a filtered appointment
      const appointment = appointments.find(apt => apt.id === payment.appointment_id);
      if (!appointment) return false;
      
      if (fundingFilter !== "all") {
        const client = clients.find(c => c.id === appointment.client_id);
        if (!client || client.funding_source !== fundingFilter) return false;
      }
      
      return true;
    });

    const totalRevenue = filteredAppointments.reduce((sum, apt) => sum + (parseFloat(apt.fee) || 0), 0);
    const totalPaid = filteredPayments
      .filter(p => p.status === 'processed')
      .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
    const totalRefunded = filteredPayments
      .filter(p => p.status === 'refunded')
      .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
    const totalOutstanding = totalRevenue - totalPaid;

    setFinancialSummary({
      totalRevenue,
      totalPaid,
      totalOutstanding,
      totalRefunded,
      appointmentCount: filteredAppointments.length,
      paymentCount: filteredPayments.filter(p => p.status === 'processed').length
    });
  };

  const getFilteredDataForExport = () => {
    const dateFilter = getDateRangeFilter();
    
    return appointments
      .filter(apt => {
        const aptDate = moment(apt.start_time);
        return aptDate.isBetween(dateFilter.start, dateFilter.end, 'day', '[]');
      })
      .map(apt => {
        const client = clients.find(c => c.id === apt.client_id);
        const aptPayments = payments.filter(p => p.appointment_id === apt.id);
        const totalPaid = aptPayments
          .filter(p => p.status === 'processed')
          .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
        
        return {
          date: moment(apt.start_time).format('DD/MM/YYYY'),
          clientName: client?.full_name || 'Unknown',
          fundingSource: client?.funding_source || 'Unknown',
          fee: parseFloat(apt.fee) || 0,
          paid: totalPaid,
          outstanding: (parseFloat(apt.fee) || 0) - totalPaid,
          paymentStatus: apt.payment_status || 'unpaid',
          appointmentStatus: apt.status
        };
      });
  };

  const exportToCSV = () => {
    const dataToExport = getFilteredDataForExport();

    const csvHeaders = ['Date', 'Client', 'Funding Source', 'Service Fee', 'Amount Paid', 'Outstanding', 'Payment Status', 'Appointment Status'];
    const csvRows = dataToExport.map(row => 
      [
        row.date,
        `"${row.clientName}"`, // handle commas in names
        row.fundingSource,
        row.fee,
        row.paid,
        row.outstanding,
        row.paymentStatus,
        row.appointmentStatus
      ].join(',')
    );

    const csvContent = [csvHeaders.join(','), ...csvRows].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `financial_report_${moment().format('YYYY-MM-DD')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    
    toast.success("Financial report exported to CSV successfully!");
  };

  // Removed exportToPDF function

  const getPaymentMethodSummary = () => {
    const dateFilter = getDateRangeFilter();
    const filteredPayments = payments.filter(payment => {
      const paymentDate = moment(payment.payment_date);
      return paymentDate.isBetween(dateFilter.start, dateFilter.end, 'day', '[]') && 
             payment.status === 'processed';
    });

    const summary = {};
    filteredPayments.forEach(payment => {
      const method = payment.payment_method;
      if (!summary[method]) {
        summary[method] = { count: 0, total: 0 };
      }
      summary[method].count += 1;
      summary[method].total += parseFloat(payment.amount) || 0;
    });

    const totalPaidSummary = Object.values(summary).reduce((sum, { total }) => sum + total, 0);

    return Object.entries(summary).map(([method, data]) => ({
      method,
      count: data.count,
      total: data.total,
      percentage: totalPaidSummary > 0 ? (data.total / totalPaidSummary) * 100 : 0
    }));
  };

  const getFundingSourceSummary = () => {
    const dateFilter = getDateRangeFilter();
    const filteredAppointments = appointments.filter(apt => {
      const aptDate = moment(apt.start_time);
      return aptDate.isBetween(dateFilter.start, dateFilter.end, 'day', '[]');
    });

    const summary = {};
    filteredAppointments.forEach(apt => {
      const client = clients.find(c => c.id === apt.client_id);
      const fundingSource = client?.funding_source || 'unknown';
      
      if (!summary[fundingSource]) {
        summary[fundingSource] = { count: 0, revenue: 0 };
      }
      summary[fundingSource].count += 1;
      summary[fundingSource].revenue += parseFloat(apt.fee) || 0;
    });

    const totalRevenueSummary = Object.values(summary).reduce((sum, { revenue }) => sum + revenue, 0);


    return Object.entries(summary).map(([source, data]) => ({
      source,
      count: data.count,
      revenue: data.revenue,
      percentage: totalRevenueSummary > 0 ? (data.revenue / totalRevenueSummary) * 100 : 0
    }));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-slate-600">Loading financial data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30 p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-green-600 rounded-lg flex items-center justify-center shadow-md">
              <DollarSign className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Financial Dashboard</h1>
              <p className="text-slate-600">Track revenue, payments, and generate reports</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={exportToCSV} variant="outline" className="bg-white">
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
            {/* Removed PDF Export Button */}
          </div>
        </div>

        {/* Filters */}
        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Report Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label>Date Range</Label>
                <Select value={dateRange} onValueChange={setDateRange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="current_month">Current Month</SelectItem>
                    <SelectItem value="last_month">Last Month</SelectItem>
                    <SelectItem value="current_quarter">Current Quarter</SelectItem>
                    <SelectItem value="current_year">Current Year</SelectItem>
                    <SelectItem value="last_year">Last Year</SelectItem>
                    <SelectItem value="custom">Custom Range</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {dateRange === "custom" && (
                <>
                  <div>
                    <Label>Start Date</Label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>End Date</Label>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                </>
              )}

              <div>
                <Label>Funding Source</Label>
                <Select value={fundingFilter} onValueChange={setFundingFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sources</SelectItem>
                    <SelectItem value="dva">DVA</SelectItem>
                    <SelectItem value="private_health">Private Health</SelectItem>
                    <SelectItem value="medicare">Medicare</SelectItem>
                    <SelectItem value="workcover_qld">WorkCover QLD</SelectItem>
                    <SelectItem value="ndis">NDIS</SelectItem>
                    <SelectItem value="self_funded">Self Funded</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Payment Status</Label>
                <Select value={paymentStatusFilter} onValueChange={setPaymentStatusFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="partially_paid">Partially Paid</SelectItem>
                    <SelectItem value="unpaid">Unpaid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Financial Summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Total Revenue</p>
                  <p className="text-2xl font-bold text-slate-900">
                    ${financialSummary.totalRevenue.toFixed(2)}
                  </p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-blue-600" />
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                {financialSummary.appointmentCount} appointments
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Amount Paid</p>
                  <p className="text-2xl font-bold text-green-600">
                    ${financialSummary.totalPaid.toFixed(2)}
                  </p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-green-600" />
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                {financialSummary.paymentCount} payments
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Outstanding</p>
                  <p className="text-2xl font-bold text-orange-600">
                    ${financialSummary.totalOutstanding.toFixed(2)}
                  </p>
                </div>
                <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                  <Clock className="w-6 h-6 text-orange-600" />
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                {((financialSummary.totalRevenue > 0 ? financialSummary.totalOutstanding / financialSummary.totalRevenue : 0) * 100).toFixed(1)}% of revenue
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Refunded</p>
                  <p className="text-2xl font-bold text-red-600">
                    ${financialSummary.totalRefunded.toFixed(2)}
                  </p>
                </div>
                <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                  <AlertCircle className="w-6 h-6 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Breakdowns */}
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Payment Methods */}
          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Payment Methods
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {getPaymentMethodSummary().map(({ method, count, total, percentage }) => (
                  <div key={method} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div>
                      <p className="font-medium capitalize">{method.replace('_', ' ')}</p>
                      <p className="text-sm text-slate-600">{count} payments</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">${total.toFixed(2)}</p>
                      <p className="text-sm text-slate-600">{percentage.toFixed(1)}%</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Funding Sources */}
          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChart className="w-5 h-5" />
                Revenue by Funding Source
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {getFundingSourceSummary().map(({ source, count, revenue, percentage }) => (
                  <div key={source} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div>
                      <p className="font-medium capitalize">{source.replace('_', ' ')}</p>
                      <p className="text-sm text-slate-600">{count} appointments</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">${revenue.toFixed(2)}</p>
                      <p className="text-sm text-slate-600">{percentage.toFixed(1)}%</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}