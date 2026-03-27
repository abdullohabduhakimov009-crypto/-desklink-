import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  HiDocumentText as FileText, 
  HiPlusCircle as PlusCircle, 
  HiCheckCircle as CheckCircle, 
  HiXCircle as XCircle, 
  HiClock as Clock,
  HiCurrencyDollar as DollarSign,
  HiChevronRight as ChevronRight,
  HiMagnifyingGlass as Search,
  HiArrowPath as Loader2,
  HiPaperAirplane as Send,
  HiTrash as Trash2,
  HiXMark as X,
  HiChatBubbleLeftRight as MessageSquare
} from 'react-icons/hi2';
import { 
  db, 
  collection, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  addDoc, 
  serverTimestamp, 
  updateDoc, 
  doc,
  getDoc,
  deleteDoc,
  auth
} from '../firebase';
import { PremiumButton } from './PremiumButton';
import { useLanguage } from '../context/LanguageContext';
import { useNotifications } from '../context/NotificationContext';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

interface QuotationPortalProps {
  role: 'admin' | 'client';
  userEmail?: string;
  userName?: string;
}

const QuotationPortal: React.FC<QuotationPortalProps> = ({ role, userEmail, userName }) => {
  const { t } = useLanguage();
  const { addNotification } = useNotifications();
  const [quotations, setQuotations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState<any>(null);
  const [quoteToDelete, setQuoteToDelete] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [newQuote, setNewQuote] = useState({
    project: '',
    description: '',
    estimatedBudget: '',
    currency: 'USD',
    clientEmail: '',
    clientName: '',
    clientUid: ''
  });
  const [clients, setClients] = useState<any[]>([]);
  const [editAmount, setEditAmount] = useState('');
  const [editCurrency, setEditCurrency] = useState('USD');

  const handleFirestoreError = (error: unknown, operationType: OperationType, path: string | null) => {
    const errInfo: FirestoreErrorInfo = {
      error: error instanceof Error ? error.message : String(error),
      authInfo: {
        userId: auth.currentUser?.uid,
        email: auth.currentUser?.email,
        emailVerified: auth.currentUser?.emailVerified,
        isAnonymous: auth.currentUser?.isAnonymous,
        tenantId: auth.currentUser?.tenantId,
        providerInfo: auth.currentUser?.providerData.map(provider => ({
          providerId: provider.providerId,
          displayName: provider.displayName,
          email: provider.email,
          photoUrl: provider.photoURL
        })) || []
      },
      operationType,
      path
    };
    console.error('Firestore Error: ', JSON.stringify(errInfo));
    throw new Error(JSON.stringify(errInfo));
  };

  useEffect(() => {
    if (role === 'admin') {
      const q = query(collection(db, "users"), where("role", "==", "client"));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setClients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }, (error) => {
        console.error("Error fetching clients:", error);
      });
      return () => unsubscribe();
    }
  }, [role]);

  useEffect(() => {
    let q;
    const path = "quotations";
    try {
      if (role === 'admin') {
        q = query(collection(db, path), orderBy("createdAt", "desc"));
      } else {
        q = query(
          collection(db, path), 
          where("clientUid", "==", auth.currentUser?.uid), 
          orderBy("createdAt", "desc")
        );
      }

      const unsubscribe = onSnapshot(q, (snapshot) => {
        setQuotations(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setIsLoading(false);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, path);
      });

      return () => unsubscribe();
    } catch (error) {
      console.error("Setup error:", error);
      setIsLoading(false);
    }
  }, [role, userEmail]);

  const handleRequestQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuote.project || !newQuote.description) return;
    if (role === 'admin' && !newQuote.clientEmail) return;

    const path = "quotations";
    try {
      await addDoc(collection(db, path), {
        clientName: role === 'admin' ? newQuote.clientName : (userName || userEmail || t.clientPortal.quotations.unknownClient),
        clientUid: role === 'admin' ? newQuote.clientUid : auth.currentUser?.uid,
        project: newQuote.project,
        description: newQuote.description,
        amount: newQuote.estimatedBudget || 'TBD',
        currency: newQuote.currency,
        status: role === 'admin' ? 'Sent' : 'Draft',
        createdAt: serverTimestamp()
      });

      setShowRequestModal(false);
      setNewQuote({ project: '', description: '', estimatedBudget: '', currency: 'USD', clientEmail: '', clientName: '', clientUid: '' });
      addNotification({
        type: 'success',
        title: role === 'admin' ? "Quotation Created" : t.clientPortal.quotations.notifications.requestSentTitle,
        message: role === 'admin' ? "The quotation has been created and sent to the client." : t.clientPortal.quotations.notifications.requestSentMessage
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
      addNotification({
        type: 'error',
        title: t.clientPortal.quotations.notifications.requestFailedTitle,
        message: t.clientPortal.quotations.notifications.requestFailedMessage
      });
    }
  };

  const handleUpdateStatus = async (quoteId: string, newStatus: string) => {
    const path = `quotations/${quoteId}`;
    try {
      await updateDoc(doc(db, "quotations", quoteId), {
        status: newStatus,
        updatedAt: serverTimestamp()
      });

      // If this quote is linked to a ticket, update the ticket status too
      const quote = quotations.find(q => q.id === quoteId);
      if (quote?.ticketId) {
        const ticketRef = doc(db, "tickets", quote.ticketId);
        const ticketSnap = await getDoc(ticketRef);
        
        if (ticketSnap.exists()) {
          const ticketData = ticketSnap.data();
          if (newStatus === 'Approved') {
            const isEngineerAssigned = !!ticketData.engineerName;
            await updateDoc(ticketRef, {
              status: isEngineerAssigned ? 'In Progress' : 'Quote Accepted',
              "quote.status": 'Accepted',
              updatedAt: serverTimestamp(),
              updates: [
                ...(ticketData.updates || []),
                { 
                  text: `Client accepted the quotation via Quotation Portal.${isEngineerAssigned ? ' Ticket moved to In Progress.' : ''}`, 
                  timestamp: new Date().toISOString(), 
                  author: 'Client' 
                }
              ]
            });
          } else if (newStatus === 'Rejected') {
            await updateDoc(ticketRef, {
              status: 'Rejected',
              "quote.status": 'Declined',
              updatedAt: serverTimestamp(),
              updates: [
                ...(ticketData.updates || []),
                { 
                  text: 'Client rejected the quotation via Quotation Portal.', 
                  timestamp: new Date().toISOString(), 
                  author: 'Client' 
                }
              ]
            });
          }
        }
      }

      addNotification({
        type: 'success',
        title: t.clientPortal.quotations.notifications.statusUpdatedTitle,
        message: t.clientPortal.quotations.notifications.statusUpdatedMessage.replace('{status}', newStatus)
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
      addNotification({
        type: 'error',
        title: t.clientPortal.quotations.notifications.updateFailedTitle,
        message: t.clientPortal.quotations.notifications.updateFailedMessage
      });
    }
  };

  const handleEditQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedQuote) return;

    const path = `quotations/${selectedQuote.id}`;
    try {
      await updateDoc(doc(db, "quotations", selectedQuote.id), {
        amount: editAmount,
        currency: editCurrency,
        updatedAt: serverTimestamp()
      });
      setShowEditModal(false);
      addNotification({
        type: 'success',
        title: t.clientPortal.quotations.notifications.statusUpdatedTitle,
        message: t.clientPortal.quotations.notifications.statusUpdatedMessage.replace('{status}', selectedQuote.status)
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const handleDeleteQuote = async () => {
    if (!quoteToDelete) return;

    const path = `quotations/${quoteToDelete}`;
    try {
      await deleteDoc(doc(db, "quotations", quoteToDelete));
      setShowDeleteModal(false);
      setQuoteToDelete(null);
      addNotification({
        type: 'success',
        title: "Quotation Deleted",
        message: "The quotation has been removed successfully."
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  const filteredQuotes = quotations.filter(q => {
    const project = q.project || '';
    const clientName = q.clientName || '';
    const search = searchQuery.toLowerCase();
    return project.toLowerCase().includes(search) || clientName.toLowerCase().includes(search);
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">{t.clientPortal.quotations.title}</h2>
            <span className="px-2.5 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-black rounded-full uppercase tracking-widest">
              {quotations.length} Total
            </span>
          </div>
          <p className="text-sm text-slate-500">{t.clientPortal.quotations.subtitle}</p>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder={t.clientPortal.quotations.searchPlaceholder} 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-brand-teal transition-all"
            />
          </div>
          <PremiumButton 
            onClick={() => setShowRequestModal(true)}
            variant="primary"
            className="!rounded-xl"
            glow
          >
            <PlusCircle className="w-5 h-5 mr-2" />
            {role === 'admin' ? "Create Quotation" : t.clientPortal.quotations.requestButton}
          </PremiumButton>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-10 h-10 text-brand-teal animate-spin mb-4" />
          <p className="text-slate-400 font-medium">{t.clientPortal.quotations.loading}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredQuotes.map((quote) => (
            <motion.div 
              key={quote.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-md transition-all group"
            >
              <div className="flex flex-col md:flex-row justify-between gap-6">
                <div className="flex gap-4">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
                    quote.status === 'Approved' ? 'bg-emerald-50 text-emerald-500' :
                    quote.status === 'Rejected' ? 'bg-rose-50 text-rose-500' :
                    quote.status === 'Sent' ? 'bg-blue-50 text-blue-500' : 'bg-slate-50 text-slate-400'
                  }`}>
                    <FileText className="w-7 h-7" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 group-hover:text-brand-teal transition-colors">{quote.project}</h3>
                    <p className="text-sm text-slate-500 line-clamp-1 mb-2">{quote.description}</p>
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                        {role === 'admin' ? `${quote.clientName} (${quote.clientEmail})` : 'DeskLink Solutions'}
                      </span>
                      <span className="w-1 h-1 bg-slate-200 rounded-full" />
                      <span className="text-xs text-slate-400">
                        {quote.createdAt?.toDate ? quote.createdAt.toDate().toLocaleDateString() : t.clientPortal.quotations.recent}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col md:items-end justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="text-right mr-2">
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.clientPortal.quotations.estimatedAmount}</div>
                      <div className="text-xl font-black text-slate-900">
                        {quote.currency === 'EUR' ? '€' : '$'}
                        {quote.amount}
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                      quote.status === 'Approved' ? 'bg-emerald-100 text-emerald-600' :
                      quote.status === 'Rejected' ? 'bg-rose-100 text-rose-600' :
                      quote.status === 'Sent' ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {quote.status === 'Approved' ? t.clientPortal.quotations.status.approved :
                       quote.status === 'Rejected' ? t.clientPortal.quotations.status.rejected :
                       quote.status === 'Sent' ? t.clientPortal.quotations.status.sent :
                       t.clientPortal.quotations.status.draft}
                    </span>
                  </div>

                  {role === 'admin' && quote.status === 'Draft' && (
                    <div className="flex items-center gap-2">
                      <PremiumButton 
                        onClick={() => {
                          setSelectedQuote(quote);
                          setEditAmount(quote.amount);
                          setEditCurrency(quote.currency || 'USD');
                          setShowEditModal(true);
                        }}
                        variant="ghost"
                        className="!px-4 !py-2 !text-xs !rounded-xl text-slate-500 hover:text-slate-700"
                      >
                        Edit Amount
                      </PremiumButton>
                      <PremiumButton 
                        onClick={() => handleUpdateStatus(quote.id, 'Sent')}
                        variant="primary"
                        className="!px-4 !py-2 !text-xs !rounded-xl"
                      >
                        <Send className="w-4 h-4 mr-2" /> {t.clientPortal.quotations.sendToClient}
                      </PremiumButton>
                      <button 
                        onClick={() => {
                          setQuoteToDelete(quote.id);
                          setShowDeleteModal(true);
                        }}
                        className="p-2 text-rose-400 hover:text-rose-600 transition-all"
                        title="Delete Quotation"
                      >
                        <XCircle className="w-5 h-5" />
                      </button>
                    </div>
                  )}

                  {role === 'admin' && quote.status === 'Sent' && (
                    <div className="flex items-center gap-2">
                      <PremiumButton 
                        onClick={() => handleUpdateStatus(quote.id, 'Approved')}
                        variant="primary"
                        className="!px-4 !py-2 !text-xs !rounded-xl !bg-emerald-500 !text-white hover:!bg-emerald-600"
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Approve
                      </PremiumButton>
                      <PremiumButton 
                        onClick={() => handleUpdateStatus(quote.id, 'Rejected')}
                        variant="primary"
                        className="!px-4 !py-2 !text-xs !rounded-xl !bg-rose-500 !text-white hover:!bg-rose-600"
                      >
                        <XCircle className="w-4 h-4 mr-2" />
                        Reject
                      </PremiumButton>
                    </div>
                  )}

                  {role === 'client' && quote.status === 'Sent' && (
                    <div className="flex items-center gap-2">
                      <PremiumButton 
                        onClick={() => handleUpdateStatus(quote.id, 'Approved')}
                        variant="primary"
                        className="!px-4 !py-2 !text-xs !rounded-xl !bg-emerald-500 !text-white hover:!bg-emerald-600"
                      >
                        {t.clientPortal.quotations.approveQuote}
                      </PremiumButton>
                      <PremiumButton 
                        onClick={() => handleUpdateStatus(quote.id, 'Rejected')}
                        variant="primary"
                        className="!px-4 !py-2 !text-xs !rounded-xl !bg-rose-500 !text-white hover:!bg-rose-600"
                      >
                        {t.clientPortal.quotations.reject}
                      </PremiumButton>
                    </div>
                  )}

                  <button 
                    onClick={() => {
                      setSelectedQuote(quote);
                      setShowDetailsModal(true);
                    }}
                    className="text-xs font-bold text-brand-teal hover:underline uppercase tracking-widest flex items-center gap-1 mt-2"
                  >
                    View Details <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}

          {filteredQuotes.length === 0 && (
            <div className="text-center py-20 bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200">
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-slate-300 mx-auto mb-4">
                <FileText className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">{t.clientPortal.quotations.noQuotations}</h3>
              <p className="text-sm text-slate-400">{t.clientPortal.quotations.noQuotationsDesc}</p>
            </div>
          )}
        </div>
      )}

      {/* Request Quote Modal */}
      <AnimatePresence>
        {showRequestModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowRequestModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-lg rounded-[2.5rem] p-10 shadow-2xl relative z-10 overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-brand-teal/5 rounded-full -mr-16 -mt-16" />
              
              <h3 className="text-2xl font-black text-slate-900 mb-2">
                {role === 'admin' ? "Create New Quotation" : t.clientPortal.quotations.modal.title}
              </h3>
              <p className="text-slate-500 text-sm mb-8">
                {role === 'admin' ? "Create a professional quotation for a client." : t.clientPortal.quotations.modal.subtitle}
              </p>

              <form onSubmit={handleRequestQuote} className="space-y-6">
                {role === 'admin' && (
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Select Client</label>
                    <select 
                      required
                      value={newQuote.clientUid}
                      onChange={(e) => {
                        const client = clients.find(c => c.id === e.target.value);
                        setNewQuote({
                          ...newQuote, 
                          clientUid: e.target.value,
                          clientName: client?.displayName || client?.email || ''
                        });
                      }}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-slate-900 focus:border-brand-teal transition-all outline-none"
                    >
                      <option value="">Select a client...</option>
                      {clients.map(client => (
                        <option key={client.id} value={client.id}>
                          {client.displayName || client.email} ({client.email})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{t.clientPortal.quotations.modal.projectName}</label>
                  <div className="relative">
                    <FileText className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                      type="text"
                      required
                      value={newQuote.project}
                      onChange={(e) => setNewQuote({...newQuote, project: e.target.value})}
                      placeholder={t.clientPortal.quotations.modal.projectNamePlaceholder} 
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 !pl-16 text-slate-900 focus:border-brand-teal transition-all outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{t.clientPortal.quotations.modal.description}</label>
                  <div className="relative">
                    <MessageSquare className="absolute left-4 top-5 w-4 h-4 text-slate-400" />
                    <textarea 
                      required
                      rows={4}
                      value={newQuote.description}
                      onChange={(e) => setNewQuote({...newQuote, description: e.target.value})}
                      placeholder={t.clientPortal.quotations.modal.descriptionPlaceholder} 
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 !pl-16 text-slate-900 focus:border-brand-teal transition-all outline-none resize-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{t.clientPortal.quotations.modal.estimatedBudget}</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      {newQuote.currency === 'USD' ? (
                        <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      ) : (
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">€</span>
                      )}
                      <input 
                        type="text"
                        value={newQuote.estimatedBudget}
                        onChange={(e) => setNewQuote({...newQuote, estimatedBudget: e.target.value.replace(/[^0-9.]/g, '')})}
                        placeholder={t.clientPortal.quotations.modal.estimatedBudgetPlaceholder} 
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 !pl-16 text-slate-900 focus:border-brand-teal transition-all outline-none"
                      />
                    </div>
                    <div className="flex bg-slate-100 p-1 rounded-2xl">
                      <button
                        type="button"
                        onClick={() => setNewQuote({...newQuote, currency: 'USD'})}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${newQuote.currency === 'USD' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                      >
                        USD
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewQuote({...newQuote, currency: 'EUR'})}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${newQuote.currency === 'EUR' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                      >
                        EUR
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <PremiumButton 
                    type="button"
                    onClick={() => setShowRequestModal(false)}
                    variant="ghost"
                    className="flex-1 !py-4 text-slate-500 hover:text-slate-700"
                  >
                    {t.clientPortal.common.cancel}
                  </PremiumButton>
                  <PremiumButton 
                    type="submit"
                    variant="primary"
                    className="flex-1 !py-4 !rounded-2xl"
                    glow
                  >
                    {t.clientPortal.quotations.modal.submit}
                  </PremiumButton>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Quote Modal (Admin) */}
      <AnimatePresence>
        {showEditModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowEditModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-md rounded-[2.5rem] p-10 shadow-2xl relative z-10"
            >
              <h3 className="text-2xl font-black text-slate-900 mb-2">Edit Quotation</h3>
              <p className="text-slate-500 text-sm mb-8">Set the final amount for this project.</p>

              <form onSubmit={handleEditQuote} className="space-y-6">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Quote Amount</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      {editCurrency === 'USD' ? (
                        <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      ) : (
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">€</span>
                      )}
                      <input 
                        type="text"
                        required
                        value={editAmount}
                        onChange={(e) => setEditAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                        placeholder="0.00"
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 !pl-16 text-slate-900 focus:border-brand-teal transition-all outline-none"
                      />
                    </div>
                    <div className="flex bg-slate-100 p-1 rounded-2xl">
                      <button
                        type="button"
                        onClick={() => setEditCurrency('USD')}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${editCurrency === 'USD' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                      >
                        USD
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditCurrency('EUR')}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${editCurrency === 'EUR' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                      >
                        EUR
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <PremiumButton 
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    variant="ghost"
                    className="flex-1 !py-4 text-slate-500 hover:text-slate-700"
                  >
                    {t.clientPortal.common.cancel}
                  </PremiumButton>
                  <PremiumButton 
                    type="submit"
                    variant="primary"
                    className="flex-1 !py-4 !rounded-2xl"
                    glow
                  >
                    Save Changes
                  </PremiumButton>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDeleteModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-sm rounded-[2.5rem] p-10 shadow-2xl relative z-10 text-center"
            >
              <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 className="w-10 h-10" />
              </div>
              <h3 className="text-2xl font-black text-slate-900 mb-2">Delete Quote?</h3>
              <p className="text-slate-500 text-sm mb-8">This action cannot be undone. Are you sure you want to remove this quotation request?</p>

              <div className="flex gap-4">
                <PremiumButton 
                  onClick={() => setShowDeleteModal(false)}
                  variant="ghost"
                  className="flex-1 !py-4 text-slate-500 hover:text-slate-700"
                >
                  Cancel
                </PremiumButton>
                <PremiumButton 
                  onClick={handleDeleteQuote}
                  variant="primary"
                  className="flex-1 !py-4 !rounded-2xl !bg-rose-500 !text-white hover:!bg-rose-600"
                >
                  Delete
                </PremiumButton>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* View Details Modal */}
      <AnimatePresence>
        {showDetailsModal && selectedQuote && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDetailsModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-2xl rounded-[2.5rem] p-10 shadow-2xl relative z-10 overflow-hidden"
            >
              <div className="flex justify-between items-start mb-8">
                <div>
                  <h3 className="text-2xl font-black text-slate-900 mb-1">{selectedQuote.project}</h3>
                  <div className="flex items-center gap-2">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                      selectedQuote.status === 'Approved' ? 'bg-emerald-100 text-emerald-600' :
                      selectedQuote.status === 'Rejected' ? 'bg-rose-100 text-rose-600' :
                      selectedQuote.status === 'Sent' ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {selectedQuote.status}
                    </span>
                    <span className="text-xs text-slate-400">Requested on {selectedQuote.createdAt ? new Date(selectedQuote.createdAt.seconds * 1000).toLocaleDateString() : 'Recent'}</span>
                  </div>
                </div>
                <button onClick={() => setShowDetailsModal(false)} className="p-2 hover:bg-slate-100 rounded-full transition-all">
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                <div className="space-y-4">
                  <div className="p-6 bg-slate-50 rounded-3xl">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Client Details</div>
                    <div className="font-bold text-slate-900">{selectedQuote.clientName}</div>
                    <div className="text-sm text-slate-500">{selectedQuote.clientEmail}</div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="p-6 bg-slate-50 rounded-3xl">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Financials</div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm text-slate-500">Est. Budget:</span>
                      <span className="text-sm font-bold text-slate-900">
                        {selectedQuote.currency === 'EUR' ? '€' : '$'}
                        {selectedQuote.estimatedBudget}
                      </span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                      <span className="text-sm text-slate-500">Quote Amount:</span>
                      <span className="text-lg font-black text-brand-teal">
                        {selectedQuote.amount ? `${selectedQuote.currency === 'EUR' ? '€' : '$'}${selectedQuote.amount}` : 'Pending'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4 mb-10">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Project Description</div>
                <div className="p-6 bg-slate-50 rounded-3xl text-sm text-slate-600 leading-relaxed max-h-48 overflow-y-auto whitespace-pre-wrap">
                  {selectedQuote.description}
                </div>
              </div>

              <div className="flex gap-4">
                {role === 'admin' && (
                  <button 
                    onClick={() => {
                      setShowDetailsModal(false);
                      setEditAmount(selectedQuote.amount || '');
                      setEditCurrency(selectedQuote.currency || 'USD');
                      setShowEditModal(true);
                    }}
                    className="flex-1 py-4 bg-brand-teal text-brand-dark font-bold rounded-2xl hover:bg-teal-400 transition-all shadow-lg shadow-brand-teal/20"
                  >
                    Edit Amount
                  </button>
                )}
                <button 
                  onClick={() => setShowDetailsModal(false)}
                  className="flex-1 py-4 text-slate-400 font-bold hover:text-slate-600 transition-all"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default QuotationPortal;
