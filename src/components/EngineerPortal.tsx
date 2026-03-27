import React, { useState, useEffect, useMemo, useRef } from 'react';
import ISO6391 from 'iso-639-1';
import NotificationDropdown from './NotificationDropdown';
import CustomDropdown from './CustomDropdown';
import { 
  db, 
  auth,
  collection, 
  query, 
  where, 
  onSnapshot, 
  onAuthStateChanged,
  orderBy, 
  updateDoc, 
  doc,
  addDoc,
  serverTimestamp 
} from '../firebase';
// import { collection, query, where, onSnapshot, orderBy, updateDoc, doc } from 'firebase/firestore';
import { 
  HiHome as Home,
  HiUser as User, 
  HiMagnifyingGlass as Search, 
  HiChatBubbleLeftRight as MessageSquare, 
  HiCog6Tooth as Settings, 
  HiArrowLeftOnRectangle as LogOut, 
  HiGlobeAlt as Globe, 
  HiBell as Bell, 
  HiBars3 as Menu, 
  HiXMark as X, 
  HiChevronRight as ChevronRight, 
  HiMapPin as MapPin, 
  HiBriefcase as Briefcase, 
  HiStar as Star, 
  HiClock as Clock, 
  HiCurrencyDollar as DollarSign, 
  HiLanguage as Languages, 
  HiPhone as Phone,
  HiCodeBracket as Code, 
  HiDocumentText as FileText, 
  HiCamera as Camera, 
  HiPencilSquare as Edit3, 
  HiCheckCircle as CheckCircle2, 
  HiExclamationTriangle as AlertTriangle,
  HiShieldCheck as ShieldCheck, 
  HiMap as MapIcon, 
  HiLockClosed as LockIcon,
  HiCheck as Check,
  HiXMark as XMark,
  HiTicket as Ticket,
  HiEnvelope as Mail,
  HiCalendar as Calendar,
  HiPlus as Plus,
  HiGlobeAlt as Globe2,
  HiCodeBracket as Code2
} from 'react-icons/hi2';
import Select from 'react-select';
import { Country, City } from 'country-state-city';
import Logo from './Logo';
import { motion, AnimatePresence } from 'framer-motion';
import LogoutConfirmModal from './LogoutConfirmModal';
import MessagingSystem from './MessagingSystem';
import ActivityFeed from './ActivityFeed';
import SettingsView from './SettingsView';
import { useLanguage } from '../context/LanguageContext';
import { useNotifications } from '../context/NotificationContext';

import TicketDetailView from './TicketDetailView';
import PaymentSetup from './PaymentSetup';

interface EngineerPortalProps {
  user: any;
  onLogout: () => void;
}

const EngineerPortal: React.FC<EngineerPortalProps> = ({ user, onLogout }) => {
  const { t, language, setLanguage } = useLanguage();
  const { addNotification } = useNotifications();
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('desklink_engineer_activeTab') || 'dashboard');

  useEffect(() => {
    localStorage.setItem('desklink_engineer_activeTab', activeTab);
  }, [activeTab]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isDashboardExpanded, setIsDashboardExpanded] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [tickets, setTickets] = useState<any[]>([]);
  const [availableTickets, setAvailableTickets] = useState<any[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);
  const langMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (langMenuRef.current && !langMenuRef.current.contains(event.target as Node)) {
        setIsLangMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Profile editing state
  const [isEditing, setIsEditing] = useState(false);
  const [editedUser, setEditedUser] = useState<any>(user);
  const [isSaving, setIsSaving] = useState(false);
  const [clients, setClients] = useState<any[]>([]);
  const [showPaymentSetup, setShowPaymentSetup] = useState(false);
  const [hasDismissedPaymentSetup, setHasDismissedPaymentSetup] = useState(false);

  useEffect(() => {
    if (user && user.role === 'engineer' && !user.paymentDetails && !hasDismissedPaymentSetup) {
      setShowPaymentSetup(true);
    }
  }, [user, hasDismissedPaymentSetup]);

  useEffect(() => {
    setEditedUser(user);
  }, [user]);

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      await updateDoc(doc(db, "users", user.uid || user.id), editedUser);
      setIsEditing(false);
      addNotification({
        type: 'success',
        title: 'Profile Updated',
        message: 'Profile updated successfully!'
      });
    } catch (error) {
      console.error("Error updating profile:", error);
      addNotification({
        type: 'error',
        title: 'Update Failed',
        message: 'Failed to update profile.'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setEditedUser((prev: any) => {
      const newState = { ...prev, [name]: value };
      if (name === 'fullName') {
        newState.name = value;
      }
      return newState;
    });
  };

  const handleSelectChange = (name: string, option: any) => {
    setEditedUser((prev: any) => ({ ...prev, [name]: option }));
  };

  const proficiencyOptions = [
    { value: 'A1', label: 'A1 - Beginner' },
    { value: 'A2', label: 'A2 - Elementary' },
    { value: 'B1', label: 'B1 - Intermediate' },
    { value: 'B2', label: 'B2 - Upper Intermediate' },
    { value: 'C1', label: 'C1 - Advanced' },
    { value: 'C2', label: 'C2 - Proficient' },
  ];

  const countries = Country.getAllCountries().map(c => ({
    value: c.isoCode,
    label: c.name,
    phonecode: c.phonecode.startsWith('+') ? c.phonecode : `+${c.phonecode}`
  }));

  const [cities, setCities] = useState<any[]>([]);

  useEffect(() => {
    if (isEditing && editedUser.country) {
      const countryCities = City.getCitiesOfCountry(editedUser.country.value)?.map(c => ({
        value: c.name,
        label: c.name
      })) || [];
      setCities(countryCities);
    } else {
      setCities([]);
    }
  }, [isEditing, editedUser.country]);

  const languageOptions = useMemo(() => {
    const langNames = new Intl.DisplayNames(['en'], { type: 'language' });
    return ISO6391.getAllCodes().map(code => ({
      value: ISO6391.getName(code),
      label: langNames.of(code) || ISO6391.getName(code)
    })).sort((a, b) => a.label.localeCompare(b.label));
  }, []);

  const [currentLang, setCurrentLang] = useState<any>(null);
  const [currentLevel, setCurrentLevel] = useState<any>(null);

  const addLanguage = () => {
    if (currentLang && currentLevel) {
      const languages = Array.isArray(editedUser.languages) ? editedUser.languages : [];
      if (!languages.find((l: any) => l.name === currentLang.value)) {
        setEditedUser((prev: any) => ({
          ...prev,
          languages: [...languages, { name: currentLang.value, level: currentLevel.value }]
        }));
        setCurrentLang(null);
        setCurrentLevel(null);
      }
    }
  };

  const removeLanguage = (name: string) => {
    const languages = Array.isArray(editedUser.languages) ? editedUser.languages : [];
    setEditedUser((prev: any) => ({
      ...prev,
      languages: languages.filter((l: any) => l.name !== name)
    }));
  };

  const days = Array.from({ length: 31 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }));
  const months = [
    { value: '1', label: 'January' }, { value: '2', label: 'February' }, { value: '3', label: 'March' },
    { value: '4', label: 'April' }, { value: '5', label: 'May' }, { value: '6', label: 'June' },
    { value: '7', label: 'July' }, { value: '8', label: 'August' }, { value: '9', label: 'September' },
    { value: '10', label: 'October' }, { value: '11', label: 'November' }, { value: '12', label: 'December' }
  ];
  const years = Array.from({ length: 100 }, (_, i) => {
    const year = new Date().getFullYear() - 18 - i;
    return { value: String(year), label: String(year) };
  });

  const countryCodeOptions = useMemo(() => 
    countries.map(c => ({
      value: c.phonecode,
      label: `${c.label} (${c.phonecode})`,
      isoCode: c.value
    })),
  [countries]);

  const currencyOptions = [
    { value: 'USD', label: 'US Dollar (USD)' },
    { value: 'EUR', label: 'Euro (EUR)' },
  ];

  const specializationOptions = [
    { value: 'it_support', label: 'IT Support Specialist' },
    { value: 'network_eng', label: 'Network Engineer' },
    { value: 'sys_admin', label: 'System Administrator' },
    { value: 'cloud_infra', label: 'Cloud Infrastructure Engineer' },
    { value: 'cyber_analyst', label: 'Cybersecurity Analyst' },
    { value: 'service_desk', label: 'IT Service Desk Manager' },
    { value: 'hardware_tech', label: 'Hardware Technician' },
    { value: 'db_admin', label: 'Database Administrator' },
    { value: 'it_consultant', label: 'IT Consultant' },
    { value: 'infra_arch', label: 'Infrastructure Architect' },
    { value: 'tech_support', label: 'Technical Support Engineer' },
    { value: 'voip_eng', label: 'VoIP Engineer' },
  ];

  const skillOptions = [
    { value: 'active_directory', label: 'Active Directory' },
    { value: 'cisco', label: 'Cisco Networking' },
    { value: 'linux', label: 'Linux Administration' },
    { value: 'windows_server', label: 'Windows Server' },
    { value: 'vmware', label: 'VMware / Virtualization' },
    { value: 'azure', label: 'Microsoft Azure' },
    { value: 'aws', label: 'AWS Infrastructure' },
    { value: 'cybersecurity', label: 'Cybersecurity Tools' },
    { value: 'firewalls', label: 'Firewall Management' },
    { value: 'itil', label: 'ITIL Framework' },
    { value: 'office365', label: 'Office 365 Admin' },
    { value: 'powershell', label: 'PowerShell Scripting' },
    { value: 'bash', label: 'Bash Scripting' },
    { value: 'sql', label: 'SQL Database' },
    { value: 'hardware_repair', label: 'Hardware Repair' },
    { value: 'voip', label: 'VoIP Systems' },
    { value: 'monitoring', label: 'Network Monitoring (Zabbix/Nagios)' },
    { value: 'backup', label: 'Backup & Recovery' },
  ];

  const customSelectStyles = {
    control: (base: any) => ({
      ...base,
      borderRadius: '0.75rem',
      borderColor: '#e5e7eb',
      padding: '2px',
      '&:hover': { borderColor: '#2dd4bf' }
    })
  };

  const [isFirebaseAuthenticated, setIsFirebaseAuthenticated] = useState(!!auth.currentUser);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsFirebaseAuthenticated(!!user);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!isFirebaseAuthenticated) return;

    const unsubClients = onSnapshot(collection(db, "users"), (snapshot) => {
      setClients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter((u: any) => u.role === 'client'));
    });

    const uid = user?.uid || user?.id;
    const email = user?.email;
    
    const unsubTickets = onSnapshot(
      query(
        collection(db, "tickets"), 
        where("engineerEmail", "==", email || "")
      ),
      (snapshot) => {
        setTickets(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }
    );

    const unsubAvailableTickets = onSnapshot(
      query(
        collection(db, "tickets"),
        where("status", "==", "Approved")
      ),
      (snapshot) => {
        setAvailableTickets(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }
    );

    return () => {
      unsubClients();
      unsubTickets();
      unsubAvailableTickets();
    };
  }, [isFirebaseAuthenticated, user?.email, user?.uid, user?.id]);

  const handleToggleOnSite = async (ticketId: string, currentOnSite: boolean) => {
    try {
      const ticket = tickets.find(t => t.id === ticketId);
      const isQuoteAccepted = ticket?.quote?.status === 'Accepted' || ticket?.status === 'Quote Accepted' || ticket?.status === 'In Progress';
      const newOnSiteStatus = !currentOnSite;
      
      await updateDoc(doc(db, "tickets", ticketId), {
        isOnSite: newOnSiteStatus,
        status: newOnSiteStatus ? 'On Site' : (isQuoteAccepted ? 'In Progress' : 'Assigned'),
        updatedAt: serverTimestamp(),
        updates: [
          ...(ticket?.updates || []),
          { 
            text: `Engineer is now ${newOnSiteStatus ? 'ON SITE' : 'OFF SITE'}.`, 
            timestamp: new Date().toISOString(),
            author: 'Engineer'
          }
        ]
      });
      
      // Log activity
      try {
        await addDoc(collection(db, "activities"), {
          type: 'engineer_status_update',
          title: `Engineer ${newOnSiteStatus ? 'On Site' : 'Off Site'}`,
          description: `Engineer ${user?.fullName || user?.email} is now ${newOnSiteStatus ? 'on site' : 'off site'} for Ticket #${ticketId.substring(0, 6)}`,
          userId: user?.uid || auth.currentUser?.uid,
          userName: user?.fullName || user?.email,
          timestamp: serverTimestamp()
        });
      } catch (err) {
        console.error("Error logging activity:", err);
      }

      addNotification({
        type: 'success',
        title: 'Status Updated',
        message: `You are now ${newOnSiteStatus ? 'on site' : 'off site'}.`
      });
      
      // Update local state for selected ticket
      if (selectedTicket && selectedTicket.id === ticketId) {
        setSelectedTicket({ 
          ...selectedTicket, 
          isOnSite: newOnSiteStatus,
          status: newOnSiteStatus ? 'On Site' : (isQuoteAccepted ? 'In Progress' : 'Assigned')
        });
      }
    } catch (error) {
      console.error("Error toggling on-site status:", error);
      addNotification({
        type: 'error',
        title: 'Update Failed',
        message: 'Failed to update on-site status.'
      });
    }
  };

  const filteredJobs = searchQuery.trim() === '' ? [] : []; // Placeholder for actual job filtering if needed

  const pt = (t as any).portal;
  const cvT = pt.cv;

  const profilePicUrl = React.useMemo(() => {
    if (user?.profilePic instanceof File) {
      return URL.createObjectURL(user.profilePic);
    }
    return user?.profilePic || null;
  }, [user?.profilePic]);

  const calculateCompleteness = () => {
    let score = 0;
    const total = 9;
    if (user?.fullName) score++;
    if (user?.email) score++;
    if (user?.phoneNumber) score++;
    if (user?.whatsappNumber) score++;
    if (user?.specialization || (user?.specializations && user.specializations.length > 0)) score++;
    if (user?.skills && user.skills.length > 0) score++;
    if (user?.cvFile) score++;
    if (user?.profilePic) score++;
    if (user?.bio) score++;
    
    const percentage = Math.round((score / total) * 100);
    let feedback = "";
    if (percentage === 100) feedback = "Your profile is complete! Great job.";
    else if (percentage >= 70) feedback = "Almost there! Adding more details helps you stand out.";
    else feedback = "Your profile is incomplete. We recommend adding more information before applying.";
    
    return { percentage, feedback, score, total };
  };

  const completeness = calculateCompleteness();

  const cvUrl = React.useMemo(() => {
    if (user?.cvFile instanceof File) {
      return URL.createObjectURL(user.cvFile);
    }
    return user?.cvFile || null;
  }, [user?.cvFile]);

  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  const newTicketsCount = tickets.filter(t => t.status === 'Assigned').length;

  useEffect(() => {
    const uid = user?.uid || user?.id;
    if (!uid) return;
    const q = query(
      collection(db, "messages"),
      where("receiverId", "==", uid),
      where("unread", "==", true)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setUnreadMessagesCount(snapshot.size);
    });

    return () => unsubscribe();
  }, [user?.uid, user?.id]);

  const menuItems = [
    { 
      id: 'dashboard', 
      label: pt.menu.dashboard, 
      icon: Home,
      subItems: [
        { id: 'profile', label: pt.menu.profile, icon: User },
        { id: 'bankAccountDetails', label: pt.menu.bankAccountDetails, icon: DollarSign }
      ]
    },
    { id: 'tickets', label: pt.menu.tickets, icon: Ticket, badge: newTicketsCount },
    { 
      id: 'jobs', 
      label: pt.menu.findJobs, 
      icon: Search
    },
    { id: 'messages', label: pt.menu.messages, icon: MessageSquare },
    { 
      id: 'settings', 
      label: pt.menu.settings, 
      icon: Settings
    },
  ];

  const languages = [
    { code: 'en', label: 'English', flag: '🇺🇸' },
    { code: 'ru', label: 'Русский', flag: '🇷🇺' },
    { code: 'uz', label: "O'zbekcha", flag: '🇺🇿' },
  ];

  return (
    <div className="h-screen overflow-hidden bg-gray-50 text-slate-900 flex">
      {/* Sidebar */}
      <motion.aside 
        initial={false}
        animate={{ width: isSidebarOpen ? 280 : 80 }}
        className="bg-slate-900 sticky top-0 h-screen flex flex-col z-50 shadow-2xl"
      >
        <div className="p-8 flex items-center justify-between">
          {isSidebarOpen && <Logo />}
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 hover:bg-slate-800 rounded-xl transition-colors text-gray-400 hover:text-white"
          >
            {isSidebarOpen ? <Menu className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
          </button>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          {menuItems.map((item) => (
            <div 
              key={item.id} 
              className="relative"
            >
              <button
                onClick={() => {
                  if (item.subItems) {
                    setIsDashboardExpanded(!isDashboardExpanded);
                    setActiveTab(item.id);
                  } else {
                    setActiveTab(item.id);
                  }
                }}
                className={`w-full flex items-center gap-4 p-3 rounded-xl transition-all group relative ${
                  activeTab === item.id || (item.subItems && item.subItems.some(sub => sub.id === activeTab))
                    ? 'bg-white/10 text-white font-bold shadow-lg shadow-white/5' 
                    : 'text-gray-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                {(activeTab === item.id || (item.subItems && item.subItems.some(sub => sub.id === activeTab))) && (
                  <motion.div 
                    layoutId="engineer-sidebar-indicator"
                    className="absolute left-0 w-1 h-6 bg-brand-teal rounded-r-full"
                  />
                )}
                <item.icon className={`w-5 h-5 ${activeTab === item.id || (item.subItems && item.subItems.some(sub => sub.id === activeTab)) ? 'text-white' : 'text-gray-400 group-hover:text-white transition-colors'}`} />
                {isSidebarOpen && (
                  <div className="flex-1 flex items-center justify-between">
                    <span>{item.label}</span>
                    <div className="flex items-center gap-2">
                      {item.id === 'messages' && unreadMessagesCount > 0 && (
                        <span className="bg-brand-teal text-slate-900 text-[10px] font-black px-2 py-0.5 rounded-full shadow-lg shadow-brand-teal/20">
                          {unreadMessagesCount}
                        </span>
                      )}
                      {item.id !== 'messages' && item.badge !== undefined && item.badge > 0 && (
                        <span className="bg-rose-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-lg shadow-rose-500/20">
                          {item.badge}
                        </span>
                      )}
                      {item.subItems && (
                        <ChevronRight className={`w-4 h-4 transition-transform ${isDashboardExpanded ? 'rotate-90' : ''}`} />
                      )}
                    </div>
                  </div>
                )}
              </button>

              {/* Sub Items */}
              {item.subItems && isSidebarOpen && (
                <AnimatePresence>
                  {isDashboardExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden ml-9 mt-1 space-y-1"
                    >
                      {item.subItems.map((subItem) => (
                        <button
                          key={subItem.id}
                          onClick={() => setActiveTab(subItem.id)}
                          className={`w-full flex items-center gap-3 p-2 rounded-lg text-sm transition-all ${
                            activeTab === subItem.id
                              ? 'text-brand-teal font-bold'
                              : 'text-gray-500 hover:text-white hover:bg-white/5'
                          }`}
                        >
                          <subItem.icon className="w-4 h-4" />
                          <span>{subItem.label}</span>
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              )}
            </div>
          ))}
        </nav>

        <div className="p-4 border-t border-white/5 space-y-2">
          {/* Language Menu */}
          <div className="relative group">
            <button className="w-full flex items-center gap-4 p-4 text-gray-400 hover:text-white hover:bg-white/5 rounded-xl transition-all">
              <Globe className="w-5 h-5" />
              {isSidebarOpen && (
                <div className="flex-1 flex items-center justify-between">
                  <span className="text-sm font-medium">{languages.find(l => l.code === language)?.label}</span>
                  <ChevronRight className="w-4 h-4 rotate-90" />
                </div>
              )}
            </button>
            <div className="absolute bottom-full left-0 w-full mb-2 bg-slate-800 border border-white/10 rounded-xl overflow-hidden opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 shadow-2xl">
              {languages.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => setLanguage(lang.code as any)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-white/5 transition-colors ${
                    language === lang.code ? 'text-brand-teal bg-brand-teal/5' : 'text-gray-400'
                  }`}
                >
                  <span className="text-lg">{lang.flag}</span>
                  <span className="font-medium">{lang.label}</span>
                </button>
              ))}
            </div>
          </div>

          <button 
            onClick={() => setShowLogoutConfirm(true)}
            className="w-full flex items-center gap-4 p-4 text-gray-400 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all group"
          >
            <LogOut className="w-5 h-5 group-hover:scale-110 transition-transform" />
            {isSidebarOpen && <span className="text-sm font-bold uppercase tracking-widest">{pt.menu.logout}</span>}
          </button>
        </div>
      </motion.aside>

      {/* Main Content Area */}
      <main className={`flex-1 flex flex-col min-w-0 ${activeTab === 'messages' ? 'h-screen overflow-hidden' : 'overflow-y-auto'}`}>
        {/* Top Bar with Breadcrumbs */}
        <div className="flex items-center justify-between px-6 md:px-12 py-6 md:py-8 z-40 gap-4 bg-white/50 backdrop-blur-sm sticky top-0 border-b border-gray-100/50">
          <div className="flex flex-col">
            <h2 className="text-xl font-black text-black leading-none mb-1">
              {menuItems.find(m => m.id === activeTab)?.label + (activeTab === 'messages' && unreadMessagesCount > 0 ? ` (${unreadMessagesCount})` : '') || activeTab}
            </h2>
            <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              <button 
                onClick={() => setActiveTab('profile')}
                className="hover:text-brand-teal transition-colors"
              >
                Engineer Portal
              </button>
              <ChevronRight className="w-2.5 h-2.5" />
              <span className="text-brand-teal">
                {menuItems.find(m => m.id === activeTab)?.label || activeTab}
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 rounded-full border border-emerald-100">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
              <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Network Live</span>
            </div>
            <div className="relative" ref={langMenuRef}>
              <button 
                onClick={() => setIsLangMenuOpen(!isLangMenuOpen)}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:border-brand-teal/30 transition-all shadow-sm"
              >
                <Globe className="w-4 h-4 text-brand-teal" />
                <span>{language === 'en' ? 'English' : language === 'ru' ? 'Русский' : 'O\'zbekcha'}</span>
                <ChevronRight className={`w-3 h-3 transition-transform ${isLangMenuOpen ? 'rotate-90' : ''}`} />
              </button>

              <AnimatePresence>
                {isLangMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute right-0 mt-2 w-40 bg-white rounded-2xl shadow-2xl border border-gray-100 p-2 z-50 overflow-hidden"
                  >
                    {languages.map((lang) => (
                      <button
                        key={lang.code}
                        onClick={() => {
                          setLanguage(lang.code as any);
                          setIsLangMenuOpen(false);
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-semibold transition-all ${
                          language === lang.code 
                            ? 'bg-brand-teal/10 text-brand-teal' 
                            : 'text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <span className="text-lg">{lang.flag}</span>
                        <span>{lang.label}</span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="flex items-center gap-3">
              <NotificationDropdown />

              <button 
                onClick={() => setShowLogoutConfirm(true)}
                className="w-10 h-10 bg-white border border-gray-200 rounded-xl flex items-center justify-center text-gray-400 hover:text-rose-500 hover:border-rose-200 hover:bg-rose-50 transition-all shrink-0 shadow-sm"
                title={pt.menu.logout}
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        <div className={`${activeTab === 'messages' ? 'flex-1 flex flex-col min-h-0' : 'p-6 md:p-12 pt-4 md:pt-6 max-w-[1400px] mx-auto w-full'}`}>
          <AnimatePresence mode="wait">
            {activeTab === 'dashboard' && (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="flex items-start gap-5">
                    <div className="w-14 h-14 bg-brand-teal rounded-2xl flex items-center justify-center text-brand-dark shadow-lg shadow-brand-teal/20">
                      <Home className="w-7 h-7" />
                    </div>
                    <div>
                      <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-1">{pt.dashboard.title}</h1>
                      <p className="text-slate-500 font-medium">{pt.dashboard.welcomeBack}, {user?.fullName || user?.name || 'Engineer'}</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-2 space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 transition-all group overflow-hidden relative">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-brand-teal/5 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-150 duration-700" />
                        <div className="flex items-center justify-between mb-6">
                          <div className="w-14 h-14 bg-brand-teal/10 rounded-2xl flex items-center justify-center text-brand-teal group-hover:bg-brand-teal group-hover:text-brand-dark transition-all duration-500">
                            <Ticket className="w-7 h-7" />
                          </div>
                          <div className="flex flex-col items-end">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">{pt.dashboard.assignedTickets}</span>
                            <div className="text-4xl font-black text-slate-900 tracking-tighter">{tickets.length}</div>
                          </div>
                        </div>
                      </div>

                      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 transition-all group overflow-hidden relative">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-150 duration-700" />
                        <div className="flex items-center justify-between mb-6">
                          <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-500 group-hover:bg-blue-500 group-hover:text-white transition-all duration-500">
                            <Star className="w-7 h-7" />
                          </div>
                          <div className="flex flex-col items-end">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">{pt.dashboard.rating}</span>
                            <div className="text-4xl font-black text-slate-900 tracking-tighter">{user?.rating || '0.0'}</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
                      <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                        <div className="flex items-center gap-3">
                          <Ticket className="w-5 h-5 text-brand-teal" />
                          <h3 className="text-xl font-black text-slate-900">Recent Assigned Tickets</h3>
                        </div>
                        <button 
                          onClick={() => setActiveTab('tickets')}
                          className="text-brand-teal text-sm font-bold hover:underline"
                        >
                          View All
                        </button>
                      </div>
                      <div className="p-8">
                        <div className="space-y-4">
                          {tickets.slice(0, 3).map((ticket) => (
                            <div 
                              key={ticket.id}
                              onClick={() => {
                                setActiveTab('tickets');
                                setSelectedTicket(ticket);
                              }}
                              className="flex items-center justify-between p-4 rounded-2xl border border-slate-100 hover:border-brand-teal/30 hover:bg-brand-teal/5 transition-all cursor-pointer group"
                            >
                              <div className="flex items-center gap-4">
                                <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-brand-teal group-hover:text-brand-dark transition-colors">
                                  <Ticket className="w-5 h-5" />
                                </div>
                                <div>
                                  <p className="font-bold text-slate-900">{ticket.subject}</p>
                                  <p className="text-xs text-slate-500">{ticket.clientName} • {ticket.createdAt ? (
                                    ticket.createdAt.seconds 
                                      ? new Date(ticket.createdAt.seconds * 1000).toLocaleDateString()
                                      : new Date(ticket.createdAt).toLocaleDateString()
                                  ) : 'N/A'}</p>
                                </div>
                              </div>
                              <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                                ticket.status === 'Completed' ? 'bg-slate-50 text-slate-400' : 
                                ticket.status === 'In Progress' ? 'bg-blue-50 text-blue-500' : 'bg-emerald-50 text-emerald-500'
                              }`}>
                                {ticket.status}
                              </span>
                            </div>
                          ))}
                          {tickets.length === 0 && (
                            <div className="text-center py-8 text-slate-400 italic text-sm">
                              No tickets assigned yet.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
                      <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                        <h3 className="text-xl font-black text-slate-900">{pt.dashboard.activeTasks}</h3>
                        <button onClick={() => setActiveTab('tickets')} className="text-brand-teal text-sm font-bold hover:underline">{pt.dashboard.viewAll}</button>
                      </div>
                      <div className="divide-y divide-slate-100">
                        {tickets.slice(0, 5).map((ticket, i) => (
                          <div key={i} className="p-6 flex items-center justify-between hover:bg-slate-50 transition-colors group cursor-pointer" onClick={() => { setSelectedTicket(ticket); setActiveTab('tickets'); }}>
                            <div className="flex items-center gap-4">
                              <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-xs ${
                                ticket.priority === 'High' ? 'bg-rose-50 text-rose-500' : 
                                ticket.priority === 'Medium' ? 'bg-orange-50 text-orange-500' : 'bg-blue-50 text-blue-500'
                              }`}>
                                {ticket.priority.charAt(0)}
                              </div>
                              <div>
                                <p className="font-bold text-slate-900 group-hover:text-brand-teal transition-colors">{ticket.subject}</p>
                                <p className="text-xs text-slate-500">#{ticket.id.slice(0, 6).toUpperCase()} • {ticket.clientName}</p>
                              </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-900 transition-all" />
                          </div>
                        ))}
                        {tickets.length === 0 && <p className="text-center text-slate-400 py-12">No active tasks assigned</p>}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-8">
                    <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
                      <div className="flex items-center justify-between mb-8">
                        <h3 className="text-xl font-black text-slate-900">{pt.dashboard.liveActivity}</h3>
                        <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 rounded-full">
                          <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                          <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Live</span>
                        </div>
                      </div>
                      <ActivityFeed userId={user?.uid} role="engineer" />
                    </div>

                    <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white relative overflow-hidden group">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-brand-teal/10 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-150" />
                      <h3 className="text-lg font-black mb-2 relative z-10">{pt.dashboard.networkStatus}</h3>
                      <p className="text-xs text-slate-400 mb-6 relative z-10">Connected to DeskLink Global. Latency: 22ms</p>
                      <div className="space-y-4 relative z-10">
                        <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                          <motion.div initial={{ width: 0 }} animate={{ width: '100%' }} className="h-full bg-brand-teal" />
                        </div>
                        <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-white/40">
                          <span>{pt.dashboard.status}</span>
                          <span className="text-brand-teal">{pt.dashboard.optimal}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
            {activeTab === 'profile' && (
              <motion.div 
                key="profile"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="max-w-4xl mx-auto space-y-8"
              >
                {/* Profile Hero */}
                <div className="relative bg-white border border-gray-200 rounded-3xl p-8 overflow-hidden shadow-sm">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-brand-teal/5 blur-3xl -mr-32 -mt-32 rounded-full" />
                  <div className="relative flex flex-col md:flex-row gap-8 items-center md:items-start">
                    <div className="relative group">
                      <div className="w-32 h-32 bg-gray-50 border-2 border-gray-100 rounded-3xl flex items-center justify-center overflow-hidden">
                        {profilePicUrl ? (
                          <img src={profilePicUrl} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <User className="w-12 h-12 text-gray-300" />
                        )}
                      </div>
                      <button className="absolute -bottom-2 -right-2 p-2 bg-brand-teal text-white rounded-xl shadow-lg hover:scale-110 transition-transform">
                        <Camera className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex-1 text-center md:text-left">
                      <div className="flex flex-col md:flex-row md:items-center gap-4 mb-4">
                        {isEditing ? (
                          <input 
                            type="text" 
                            name="fullName"
                            value={editedUser.fullName || ''}
                            onChange={handleInputChange}
                            className="text-3xl font-bold text-black border-b border-brand-teal outline-none bg-transparent"
                            placeholder="Full Name"
                          />
                        ) : (
                          <h1 className="text-3xl font-bold text-black">{user?.fullName || 'Not provided'}</h1>
                        )}
                        <div className="flex items-center gap-2 px-3 py-1 bg-brand-teal/10 border border-brand-teal/20 rounded-full">
                          <CheckCircle2 className="w-4 h-4 text-brand-teal" />
                          <span className="text-[10px] font-bold text-brand-teal uppercase tracking-widest">{pt.profile.verifiedEngineer}</span>
                        </div>
                      </div>
                      <div className="flex flex-wrap justify-center md:justify-start gap-6 text-gray-500 text-sm">
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4" />
                          <span>{user?.email || 'Not provided'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Briefcase className="w-4 h-4" />
                          {isEditing ? (
                            <Select 
                              isMulti
                              options={specializationOptions}
                              value={editedUser.specializations}
                              onChange={(opt) => handleSelectChange('specializations', opt)}
                              styles={customSelectStyles}
                              className="min-w-[200px]"
                              placeholder="Specializations"
                            />
                          ) : (
                            <span>
                              {Array.isArray(user?.specializations) 
                                ? user.specializations.map((s: any) => s.label || s).join(', ')
                                : (user?.specialization?.label || user?.specialization || 'Not provided')}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4" />
                          {isEditing ? (
                            <div className="flex gap-2">
                              <Select 
                                options={countries}
                                value={editedUser.country}
                                onChange={(opt) => handleSelectChange('country', opt)}
                                styles={customSelectStyles}
                                className="min-w-[150px]"
                                placeholder="Country"
                              />
                              <Select 
                                options={cities}
                                value={editedUser.city}
                                onChange={(opt) => handleSelectChange('city', opt)}
                                styles={customSelectStyles}
                                className="min-w-[150px]"
                                placeholder="City"
                                isDisabled={!editedUser.country}
                              />
                            </div>
                          ) : (
                            <span>
                              {user?.city?.label || user?.city || 'Not provided'}, {user?.country?.label || user?.country || 'Not provided'}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          {isEditing ? (
                            <div className="flex gap-2">
                              <Select 
                                options={days}
                                value={editedUser.dobDay}
                                onChange={(opt) => handleSelectChange('dobDay', opt)}
                                styles={customSelectStyles}
                                className="w-20"
                                placeholder="Day"
                              />
                              <Select 
                                options={months}
                                value={editedUser.dobMonth}
                                onChange={(opt) => handleSelectChange('dobMonth', opt)}
                                styles={customSelectStyles}
                                className="w-32"
                                placeholder="Month"
                              />
                              <Select 
                                options={years}
                                value={editedUser.dobYear}
                                onChange={(opt) => handleSelectChange('dobYear', opt)}
                                styles={customSelectStyles}
                                className="w-24"
                                placeholder="Year"
                              />
                            </div>
                          ) : (
                            <span>
                              {user?.dobDay && user?.dobMonth && user?.dobYear 
                                ? `${user.dobDay.label || user.dobDay} ${user.dobMonth.label || user.dobMonth}, ${user.dobYear.label || user.dobYear}`
                                : 'DOB not provided'}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-brand-teal">
                          <Star className="w-4 h-4 fill-brand-teal" />
                          <span className="font-bold">{user?.rating || '0.0'} ({user?.reviewCount || '0'} Reviews)</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {isEditing ? (
                        <>
                          <button 
                            onClick={handleSaveProfile}
                            disabled={isSaving}
                            className="px-6 py-3 bg-brand-teal text-white rounded-xl hover:bg-teal-300 transition-colors flex items-center gap-2 font-semibold text-sm uppercase tracking-widest shadow-lg shadow-brand-teal/20"
                          >
                            {isSaving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Check className="w-4 h-4" />}
                            Save
                          </button>
                          <button 
                            onClick={() => {
                              setIsEditing(false);
                              setEditedUser(user);
                            }}
                            className="px-6 py-3 bg-slate-100 border border-slate-200 rounded-xl hover:bg-slate-200 transition-all flex items-center gap-2 font-bold text-xs text-slate-500 uppercase tracking-widest"
                          >
                            <XMark className="w-4 h-4" />
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button 
                          onClick={() => setIsEditing(true)}
                          className="px-6 py-3 bg-brand-teal/10 border border-brand-teal/20 rounded-xl hover:bg-brand-teal/20 transition-all flex items-center gap-2 font-bold text-xs text-brand-teal uppercase tracking-widest"
                        >
                          <Edit3 className="w-4 h-4" />
                          {pt.profile.edit}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-6">
                  {[
                    { label: 'Currency', value: user?.currency || 'USD', icon: DollarSign, name: 'currency', isSelect: true, options: currencyOptions },
                    { label: pt.profile.stats.rate, value: `${user?.currency === 'EUR' ? '€' : '$'}${user?.hourlyRate ?? '0'}/hr`, icon: DollarSign, name: 'hourlyRate' },
                    { label: pt.profile.stats.halfDayRate, value: `${user?.currency === 'EUR' ? '€' : '$'}${user?.halfDayRate ?? '0'}/4h`, icon: DollarSign, name: 'halfDayRate' },
                    { label: pt.profile.stats.fullDayRate, value: `${user?.currency === 'EUR' ? '€' : '$'}${user?.fullDayRate ?? '0'}/8h`, icon: DollarSign, name: 'fullDayRate' },
                    { label: pt.profile.stats.experience, value: `${user?.experience ?? '0'}+ Years`, icon: Clock, name: 'experience' },
                    { label: pt.profile.stats.success, value: `${user?.successRate || '100'}%`, icon: CheckCircle2 },
                  ].map((stat, i) => (
                    <div key={i} className="bg-white border border-gray-200 rounded-2xl p-6 flex items-center gap-4 shadow-sm">
                      <div className="w-12 h-12 bg-brand-teal/10 rounded-xl flex items-center justify-center">
                        <stat.icon className="w-6 h-6 text-brand-teal" />
                      </div>
                      <div>
                        <div className="text-xs text-gray-400 uppercase tracking-widest font-bold mb-1">{stat.label}</div>
                        {isEditing && stat.name ? (
                          <div className="flex items-center gap-1">
                            {stat.isSelect ? (
                              <Select 
                                options={stat.options}
                                value={stat.options?.find((o: any) => o.value === editedUser[stat.name!])}
                                onChange={(opt) => handleSelectChange(stat.name!, opt?.value)}
                                styles={customSelectStyles}
                                className="w-24 text-sm"
                              />
                            ) : (
                              <>
                                {stat.name.includes('Rate') && <span className="text-gray-400">{editedUser.currency === 'EUR' ? '€' : '$'}</span>}
                                <input 
                                  type="text" 
                                  name={stat.name}
                                  value={editedUser[stat.name] || ''}
                                  onChange={handleInputChange}
                                  className="w-20 font-bold border-b border-brand-teal outline-none"
                                />
                                {stat.name === 'hourlyRate' && <span className="text-gray-400">/hr</span>}
                                {stat.name === 'halfDayRate' && <span className="text-gray-400">/4h</span>}
                                {stat.name === 'fullDayRate' && <span className="text-gray-400">/8h</span>}
                              </>
                            )}
                          </div>
                        ) : (
                          <div className="text-xl font-bold">{stat.value}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Bio Section */}
                <div className="bg-white border border-gray-200 rounded-3xl p-8 shadow-sm">
                  <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-brand-teal" />
                    {pt.profile.bio}
                  </h3>
                  {isEditing ? (
                    <textarea
                      name="bio"
                      value={editedUser.bio || ''}
                      onChange={handleInputChange}
                      className="w-full h-32 p-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:border-brand-teal transition-colors resize-none font-medium"
                      placeholder="Tell us about your professional background and expertise..."
                    />
                  ) : (
                    <p className="text-gray-600 leading-relaxed whitespace-pre-wrap font-medium">
                      {user?.bio || 'No bio provided.'}
                    </p>
                  )}
                </div>

                {/* Details Sections */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="bg-white border border-gray-200 rounded-3xl p-8 shadow-sm">
                    <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                      <Code className="w-5 h-5 text-brand-teal" />
                      {pt.profile.skills}
                    </h3>
                    {isEditing ? (
                      <Select
                        isMulti
                        options={skillOptions}
                        value={editedUser.skills}
                        onChange={(opt) => handleSelectChange('skills', opt)}
                        styles={customSelectStyles}
                        className="text-sm"
                        placeholder="Select skills..."
                      />
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {Array.isArray(user?.skills) ? (
                          user.skills.map((skill: any) => (
                            <span key={skill.value || skill} className="px-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm hover:border-brand-teal/30 transition-colors cursor-default">
                              {skill.label || skill}
                            </span>
                          ))
                        ) : (
                          (user?.skills || 'Not provided').split(',').filter(Boolean).map((skill: string) => (
                            <span key={skill} className="px-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm hover:border-brand-teal/30 transition-colors cursor-default">
                              {skill.trim()}
                            </span>
                          ))
                        )}
                      </div>
                    )}
                  </div>

                  <div className="bg-white border border-gray-200 rounded-3xl p-8 shadow-sm">
                    <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                      <Languages className="w-5 h-5 text-brand-teal" />
                      {pt.profile.languages}
                    </h3>
                    {isEditing ? (
                      <div className="space-y-4">
                        <div className="flex flex-col sm:flex-row gap-2">
                          <div className="flex-1">
                            <Select
                              options={languageOptions}
                              value={currentLang}
                              onChange={setCurrentLang}
                              styles={customSelectStyles}
                              placeholder="Language"
                            />
                          </div>
                          <div className="w-full sm:w-40">
                            <Select
                              options={proficiencyOptions}
                              value={currentLevel}
                              onChange={setCurrentLevel}
                              styles={customSelectStyles}
                              placeholder="Level"
                            />
                          </div>
                          <button
                            onClick={addLanguage}
                            className="px-4 py-2 bg-brand-teal text-slate-900 font-bold rounded-xl hover:bg-teal-300 transition-colors"
                          >
                            Add
                          </button>
                        </div>
                        <div className="space-y-2">
                          {(Array.isArray(editedUser.languages) ? editedUser.languages : []).map((lang: any, i: number) => (
                            <div key={i} className="flex items-center justify-between p-3 bg-gray-50 border border-gray-100 rounded-xl">
                              <span className="font-bold">{lang.name} - {lang.level}</span>
                              <button
                                onClick={() => removeLanguage(lang.name)}
                                className="text-red-500 hover:text-red-700 p-1"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {(user?.languages || []).length > 0 ? (
                          (user?.languages || []).map((lang: any, i: number) => (
                            <div key={i} className="flex items-center justify-between p-3 bg-gray-50 border border-gray-100 rounded-xl">
                              <span className="font-bold">{lang.name}</span>
                              <span className="text-xs px-2 py-1 bg-brand-teal/10 text-brand-teal rounded-md font-bold uppercase tracking-widest">
                                {lang.level}
                              </span>
                            </div>
                          ))
                        ) : (
                          <p className="text-gray-400 italic">No languages provided</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Contact Info Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="bg-white border border-gray-200 rounded-3xl p-8 shadow-sm">
                    <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                      <Phone className="w-5 h-5 text-brand-teal" />
                      {pt.profile.contactInfo}
                    </h3>
                    <div className="space-y-6">
                      <div className="flex items-center justify-between p-4 bg-gray-50 border border-gray-100 rounded-2xl">
                        <div className="flex flex-col flex-1">
                          <span className="text-[10px] text-gray-400 uppercase tracking-widest font-bold mb-1">{(t as any).signup.fields.phoneNumber}</span>
                          {isEditing ? (
                            <div className="flex gap-2">
                              <div className="w-32">
                                <Select 
                                  options={countryCodeOptions}
                                  value={editedUser.phoneCountryCode}
                                  onChange={(opt) => handleSelectChange('phoneCountryCode', opt)}
                                  styles={customSelectStyles}
                                  className="text-xs"
                                />
                              </div>
                              <input 
                                type="text" 
                                name="phoneNumber"
                                value={editedUser.phoneNumber || ''}
                                onChange={handleInputChange}
                                className="flex-1 bg-transparent border-b border-brand-teal outline-none font-bold"
                              />
                            </div>
                          ) : (
                            <span className="text-lg font-bold">{user?.phoneCountryCode?.value} {user?.phoneNumber}</span>
                          )}
                        </div>
                        <div className="w-10 h-10 bg-brand-teal/10 rounded-xl flex items-center justify-center ml-4">
                          <Phone className="w-5 h-5 text-brand-teal" />
                        </div>
                      </div>
                      <div className="flex items-center justify-between p-4 bg-gray-50 border border-gray-100 rounded-2xl">
                        <div className="flex flex-col flex-1">
                          <span className="text-[10px] text-gray-400 uppercase tracking-widest font-bold mb-1">{(t as any).signup.fields.whatsappNumber}</span>
                          {isEditing ? (
                            <div className="flex gap-2">
                              <div className="w-32">
                                <Select 
                                  options={countryCodeOptions}
                                  value={editedUser.whatsappCountryCode}
                                  onChange={(opt) => handleSelectChange('whatsappCountryCode', opt)}
                                  styles={customSelectStyles}
                                  className="text-xs"
                                />
                              </div>
                              <input 
                                type="text" 
                                name="whatsappNumber"
                                value={editedUser.whatsappNumber || ''}
                                onChange={handleInputChange}
                                className="flex-1 bg-transparent border-b border-brand-teal outline-none font-bold"
                              />
                            </div>
                          ) : (
                            <span className="text-lg font-bold">{user?.whatsappCountryCode?.value} {user?.whatsappNumber || 'Not provided'}</span>
                          )}
                        </div>
                        <div className="w-10 h-10 bg-[#25D366]/10 rounded-xl flex items-center justify-center ml-4">
                          <MessageSquare className="w-5 h-5 text-[#25D366]" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* CV Section */}
                  <div className="bg-white border border-gray-200 rounded-3xl p-8 shadow-sm">
                    <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                      <FileText className="w-5 h-5 text-brand-teal" />
                      CV / Resume
                    </h3>
                    <div className="p-6 bg-gray-50 border border-gray-100 rounded-2xl flex flex-col items-center text-center">
                      <div className="w-16 h-16 bg-brand-teal/10 rounded-2xl flex items-center justify-center mb-4">
                        <FileText className="w-8 h-8 text-brand-teal" />
                      </div>
                      <h4 className="font-bold mb-1">
                        {user?.cvFile instanceof File ? user.cvFile.name : (cvUrl ? 'Curriculum Vitae.pdf' : 'No CV uploaded')}
                      </h4>
                      {cvUrl && <p className="text-xs text-gray-400 mb-6 uppercase tracking-widest font-bold">Verified Document</p>}
                      
                      {cvUrl && (
                        <div className="w-full space-y-3">
                          <a 
                            href={cvUrl} 
                            download={user?.fullName ? `${user.fullName}_CV.pdf` : 'CV.pdf'}
                            className="w-full py-3 bg-brand-teal text-slate-900 font-bold rounded-xl hover:bg-teal-300 transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-xs shadow-lg shadow-brand-teal/20"
                          >
                            <FileText className="w-4 h-4" /> Download CV
                          </a>
                          <button 
                            onClick={() => window.open(cvUrl, '_blank')}
                            className="w-full py-3 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-all uppercase tracking-widest text-xs"
                          >
                            Preview
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'bankAccountDetails' && (
              <motion.div 
                key="bankAccountDetails"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="max-w-4xl mx-auto space-y-8"
              >
                <div className="bg-white border border-gray-200 rounded-3xl p-8 shadow-sm">
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 bg-brand-teal/10 rounded-2xl flex items-center justify-center text-brand-teal">
                        <DollarSign className="w-7 h-7" />
                      </div>
                      <div>
                        <h1 className="text-2xl font-bold text-slate-900">{pt.menu.bankAccountDetails}</h1>
                        <p className="text-slate-500">{t.portal.paymentSetup.subtitle}</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setShowPaymentSetup(true)}
                      className="px-6 py-2 bg-brand-teal text-brand-dark font-bold rounded-xl hover:bg-brand-teal/90 transition-all flex items-center gap-2"
                    >
                      <Edit3 className="w-4 h-4" />
                      {pt.profile.edit}
                    </button>
                  </div>

                  {user?.paymentDetails ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                        <span className="text-[10px] text-slate-400 uppercase tracking-widest font-black mb-1 block">{t.portal.paymentSetup.method}</span>
                        <p className="text-lg font-bold text-slate-900">{user.paymentDetails.method}</p>
                      </div>
                      <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                        <span className="text-[10px] text-slate-400 uppercase tracking-widest font-black mb-1 block">{t.portal.paymentSetup.accountType}</span>
                        <p className="text-lg font-bold text-slate-900">{user.paymentDetails.accountType}</p>
                      </div>
                      <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                        <span className="text-[10px] text-slate-400 uppercase tracking-widest font-black mb-1 block">{t.portal.paymentSetup.currency}</span>
                        <p className="text-lg font-bold text-slate-900">{user.paymentDetails.currency}</p>
                      </div>
                      <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                        <span className="text-[10px] text-slate-400 uppercase tracking-widest font-black mb-1 block">{t.portal.paymentSetup.bankName}</span>
                        <p className="text-lg font-bold text-slate-900">{user.paymentDetails.bankName}</p>
                      </div>
                      <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                        <span className="text-[10px] text-slate-400 uppercase tracking-widest font-black mb-1 block">{t.portal.paymentSetup.accountHolder}</span>
                        <p className="text-lg font-bold text-slate-900">{user.paymentDetails.accountHolder}</p>
                      </div>
                      <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                        <span className="text-[10px] text-slate-400 uppercase tracking-widest font-black mb-1 block">{t.portal.paymentSetup.accountNumber}</span>
                        <p className="text-lg font-bold text-slate-900">{user.paymentDetails.accountNumber}</p>
                      </div>
                      <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                        <span className="text-[10px] text-slate-400 uppercase tracking-widest font-black mb-1 block">{t.portal.paymentSetup.swiftCode}</span>
                        <p className="text-lg font-bold text-slate-900">{user.paymentDetails.swiftCode}</p>
                      </div>
                      {user.paymentDetails.routingNumber && (
                        <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                          <span className="text-[10px] text-slate-400 uppercase tracking-widest font-black mb-1 block">{t.portal.paymentSetup.routingNumber}</span>
                          <p className="text-lg font-bold text-slate-900">{user.paymentDetails.routingNumber}</p>
                        </div>
                      )}
                      {user.paymentDetails.bankAddress && (
                        <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 md:col-span-2">
                          <span className="text-[10px] text-slate-400 uppercase tracking-widest font-black mb-1 block">{t.portal.paymentSetup.bankAddress}</span>
                          <p className="text-lg font-bold text-slate-900">{user.paymentDetails.bankAddress}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="py-20 text-center bg-slate-50 rounded-[2.5rem] border border-dashed border-slate-200">
                      <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
                        <DollarSign className="w-10 h-10 text-slate-200" />
                      </div>
                      <h3 className="text-xl font-bold text-slate-900 mb-2">No payment details set</h3>
                      <p className="text-slate-400 font-medium mb-8">Please set up your bank account details to receive payments.</p>
                      <button 
                        onClick={() => setShowPaymentSetup(true)}
                        className="px-8 py-3 bg-brand-teal text-brand-dark font-bold rounded-2xl hover:bg-brand-teal/90 transition-all shadow-lg shadow-brand-teal/20"
                      >
                        Setup Bank Details
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === 'tickets' && (
              <motion.div 
                key="tickets"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8"
              >
                {selectedTicket ? (
                  <div className="space-y-6">
                    <button 
                      onClick={() => setSelectedTicket(null)}
                      className="flex items-center gap-2 text-slate-500 hover:text-brand-teal transition-colors font-bold text-sm"
                    >
                      <ChevronRight className="w-4 h-4 rotate-180" />
                      Back to Tickets
                    </button>
                    <div className="flex flex-col gap-6">
                      <div className="flex items-center justify-between p-6 bg-white rounded-3xl border border-slate-200 shadow-sm">
                        <div>
                          <h4 className="font-bold text-slate-900">On-Site Status</h4>
                          <p className="text-xs text-slate-500">Toggle this when you arrive at or leave the client location.</p>
                        </div>
                        <button 
                          onClick={() => handleToggleOnSite(selectedTicket.id, selectedTicket.isOnSite)}
                          className={`px-8 py-3 rounded-2xl font-bold text-sm transition-all flex items-center gap-2 ${
                            selectedTicket.isOnSite 
                              ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' 
                              : 'bg-slate-900 text-brand-teal hover:bg-slate-800'
                          }`}
                        >
                          <MapPin className="w-4 h-4" />
                          {selectedTicket.isOnSite ? 'You are On Site' : 'Mark as On Site'}
                        </button>
                      </div>
                      <TicketDetailView 
                        ticket={selectedTicket} 
                        t={t}
                        language={language}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {tickets.map((ticket) => (
                      <motion.div 
                        key={ticket.id}
                        whileHover={{ y: -5 }}
                        className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 transition-all group"
                      >
                        <div className="flex justify-between items-start mb-6">
                          <div className="w-14 h-14 bg-brand-teal/10 rounded-2xl flex items-center justify-center text-brand-teal group-hover:bg-brand-teal group-hover:text-brand-dark transition-all duration-500">
                            <Ticket className="w-7 h-7" />
                          </div>
                          <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
                            ticket.status === 'Completed' ? 'bg-slate-50 text-slate-400' : 
                            ticket.status === 'Waiting for Confirmation' ? 'bg-brand-teal/10 text-brand-teal' :
                            ticket.status === 'In Progress' ? 'bg-blue-50 text-blue-500' : 'bg-emerald-50 text-emerald-500'
                          }`}>
                            {ticket.status}
                          </span>
                        </div>
                        <h3 className="text-xl font-black text-slate-900 mb-2">{ticket.subject}</h3>
                        <p className="text-slate-500 font-medium mb-2">{ticket.clientName}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-6">
                          Created: {ticket.createdAt ? (
                            ticket.createdAt.seconds 
                              ? new Date(ticket.createdAt.seconds * 1000).toLocaleDateString()
                              : new Date(ticket.createdAt).toLocaleDateString()
                          ) : 'N/A'}
                        </p>
                        
                        <div className="flex items-center justify-between pt-6 border-t border-slate-100">
                          <span className={`text-[10px] font-black uppercase tracking-widest ${
                            ticket.priority === 'High' ? 'text-rose-500' : 
                            ticket.priority === 'Medium' ? 'text-orange-500' : 'text-blue-500'
                          }`}>
                            {ticket.priority}
                          </span>
                          <button 
                            onClick={() => setSelectedTicket(ticket)}
                            className="px-6 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl hover:bg-brand-teal hover:text-brand-dark transition-all"
                          >
                            View Details
                          </button>
                        </div>
                      </motion.div>
                    ))}
                    {tickets.length === 0 && (
                      <div className="col-span-full py-20 text-center">
                        <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                          <Ticket className="w-10 h-10 text-slate-200" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 mb-2">No tickets assigned</h3>
                        <p className="text-slate-400 font-medium">You don't have any tickets assigned to you yet.</p>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'jobs' && (
              <motion.div 
                key="jobs"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8"
              >
                <div className="flex flex-col md:flex-row gap-4 mb-8">
                  {(searchQuery || priorityFilter !== 'All') && (
                    <button 
                      onClick={() => {
                        setSearchQuery('');
                        setPriorityFilter('All');
                      }}
                      className="text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors self-center"
                    >
                      Clear Filters
                    </button>
                  )}
                  <div className="flex-1 relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-300" />
                    <input 
                      type="text" 
                      placeholder={pt.jobs.searchPlaceholder}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-white border border-gray-200 rounded-2xl py-4 !pl-16 pr-6 focus:outline-none focus:border-brand-teal/50 transition-colors shadow-sm"
                    />
                  </div>
                  <CustomDropdown 
                    value={priorityFilter}
                    onChange={setPriorityFilter}
                    options={[
                      { value: 'All', label: 'All Priority' },
                      { value: 'High', label: 'High' },
                      { value: 'Medium', label: 'Medium' },
                      { value: 'Low', label: 'Low' }
                    ]}
                    className="h-full"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {availableTickets.filter(ticket => 
                    (ticket.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    ticket.clientName?.toLowerCase().includes(searchQuery.toLowerCase())) &&
                    (priorityFilter === 'All' || ticket.priority === priorityFilter)
                  ).map((ticket) => (
                    <motion.div 
                      key={ticket.id}
                      whileHover={{ y: -5 }}
                      className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 transition-all group"
                    >
                      <div className="flex justify-between items-start mb-6">
                        <div className="w-14 h-14 bg-brand-teal/10 rounded-2xl flex items-center justify-center text-brand-teal group-hover:bg-brand-teal group-hover:text-brand-dark transition-all duration-500">
                          <Ticket className="w-7 h-7" />
                        </div>
                        <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
                          ticket.priority === 'High' ? 'bg-rose-50 text-rose-500' : 
                          ticket.priority === 'Medium' ? 'bg-orange-50 text-orange-500' : 'bg-blue-50 text-blue-500'
                        }`}>
                          {ticket.priority}
                        </span>
                      </div>
                      <h3 className="text-xl font-black text-slate-900 mb-2">{ticket.subject}</h3>
                      <p className="text-slate-500 font-medium mb-2">{ticket.clientName} • {ticket.location || pt.jobs.remote}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-6">
                        {pt.jobs.posted}: {ticket.createdAt ? (
                          ticket.createdAt.seconds 
                            ? new Date(ticket.createdAt.seconds * 1000).toLocaleDateString()
                            : new Date(ticket.createdAt).toLocaleDateString()
                        ) : 'N/A'}
                      </p>
                      
                      <div className="flex flex-wrap gap-2 mb-8">
                        {ticket.category && (
                          <span className="px-3 py-1 bg-slate-50 text-slate-400 text-[10px] font-bold uppercase tracking-widest rounded-lg">{ticket.category}</span>
                        )}
                        <span className="px-3 py-1 bg-slate-50 text-slate-400 text-[10px] font-bold uppercase tracking-widest rounded-lg">#{ticket.id.slice(0, 6).toUpperCase()}</span>
                      </div>

                      <div className="flex items-center justify-between pt-6 border-t border-slate-100">
                        <span className="text-lg font-black text-slate-900">{ticket.budget || '$0'}</span>
                        <button 
                          onClick={() => { setSelectedTicket(ticket); setActiveTab('tickets'); }}
                          className="px-6 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl hover:bg-brand-teal hover:text-brand-dark transition-all"
                        >
                          {pt.jobs.apply}
                        </button>
                      </div>
                    </motion.div>
                  ))}
                  {availableTickets.length === 0 && (
                    <div className="col-span-full py-20 text-center">
                      <p className="text-slate-400 font-medium">No approved tickets available at the moment.</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === 'messages' && (
              <motion.div 
                key="messages"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="h-full"
              >
                <MessagingSystem currentUser={user} role="engineer" allUsers={clients} />
              </motion.div>
            )}

            {activeTab === 'settings' && (
              <motion.div 
                key="settings"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="h-full"
              >
                <SettingsView currentUser={user} role="engineer" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      <LogoutConfirmModal 
        isOpen={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        onConfirm={onLogout}
        title={pt.logoutConfirm?.title}
        message={pt.logoutConfirm?.message}
        confirmLabel={pt.logoutConfirm?.confirm}
        cancelLabel={pt.logoutConfirm?.cancel}
      />

      {showPaymentSetup && (
        <PaymentSetup 
          user={user} 
          onComplete={() => {
            setShowPaymentSetup(false);
            setHasDismissedPaymentSetup(true);
          }} 
        />
      )}
    </div>
  );
};

export default EngineerPortal;
