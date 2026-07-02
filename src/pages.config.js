/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import AdminAnalytics from './pages/AdminAnalytics';
import AdminApprovals from './pages/AdminApprovals';
import AssessmentAudit from './pages/AssessmentAudit';
import AssessmentLibrary from './pages/AssessmentLibrary';
import Calendar from './pages/Calendar';
import ClientConditions from './pages/ClientConditions';
import ClientProfile from './pages/ClientProfile';
import Clients from './pages/Clients';
import Dashboard from './pages/Dashboard';
import Finances from './pages/Finances';
import FundingForms from './pages/FundingForms';
import Home from './pages/Home';
import MyProfile from './pages/MyProfile';
import NewAssessment from './pages/NewAssessment';
import NewAssessmentCreator from './pages/NewAssessmentCreator';
import Nutrition from './pages/Nutrition';
import Onboarding from './pages/Onboarding';
import PendingApproval from './pages/PendingApproval';
import ProfileSetup from './pages/ProfileSetup';
import Reports from './pages/Reports';
import TestRunner from './pages/TestRunner';
import TreatmentProtocols from './pages/TreatmentProtocols';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AdminAnalytics": AdminAnalytics,
    "AdminApprovals": AdminApprovals,
    "AssessmentAudit": AssessmentAudit,
    "AssessmentLibrary": AssessmentLibrary,
    "Calendar": Calendar,
    "ClientConditions": ClientConditions,
    "ClientProfile": ClientProfile,
    "Clients": Clients,
    "Dashboard": Dashboard,
    "Finances": Finances,
    "FundingForms": FundingForms,
    "Home": Home,
    "MyProfile": MyProfile,
    "NewAssessment": NewAssessment,
    "NewAssessmentCreator": NewAssessmentCreator,
    "Nutrition": Nutrition,
    "Onboarding": Onboarding,
    "PendingApproval": PendingApproval,
    "ProfileSetup": ProfileSetup,
    "Reports": Reports,
    "TestRunner": TestRunner,
    "TreatmentProtocols": TreatmentProtocols,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};