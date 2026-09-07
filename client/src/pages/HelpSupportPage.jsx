import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import HelpCenter from '../components/support/HelpCenter';
import SupportAssistantChat from '../components/support/SupportAssistantChat';
import TicketTracking from '../components/support/TicketTracking';
import TicketDetailView from '../components/support/TicketDetailView';
import FaqView from '../components/support/FaqView';
import RaiseTicketView from '../components/support/RaiseTicketView';
import { useAuth } from '../context/AuthContext';

export default function HelpSupportPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  
  // Default view is 'home'
  const currentView = searchParams.get('view') || 'home'; 
  const ticketId = searchParams.get('ticketId');
  const preloadContext = searchParams.get('preloadContext');
  const categoryId = searchParams.get('category');
  const initialQuery = searchParams.get('initialQuery') || searchParams.get('q');

  // Load real active trip from session/local storage if available
  const [activeTrip, setActiveTrip] = useState(null);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('active_passenger_booking') || localStorage.getItem('active_passenger_booking');
      if (stored) {
        const parsed = JSON.parse(stored);
        setActiveTrip(parsed);
      } else {
        setActiveTrip(null);
      }
    } catch (e) {
      setActiveTrip(null);
    }
  }, []);

  const handleNavigate = (view, params = {}) => {
    if (view === 'back') {
      if (currentView === 'home') {
        if (user?.role === 'assistant') {
          navigate('/assistant');
        } else if (user?.role === 'admin') {
          navigate('/admin');
        } else {
          navigate('/dashboard?tab=book');
        }
      } else {
        setSearchParams({ view: 'home' });
      }
      return;
    }
    
    const newParams = { view };
    if (params.ticketId) newParams.ticketId = params.ticketId;
    if (params.preloadContext) newParams.preloadContext = params.preloadContext;
    if (params.category) newParams.category = params.category;
    if (params.initialQuery) newParams.initialQuery = params.initialQuery;
    
    setSearchParams(newParams);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {currentView === 'home' && (
        <HelpCenter 
          onNavigate={handleNavigate} 
          activeTrip={activeTrip} 
          user={user} 
        />
      )}

      {currentView === 'faq' && (
        <FaqView
          onNavigate={handleNavigate}
          user={user}
          initialCategory={categoryId}
          initialQuery={initialQuery}
        />
      )}

      {currentView === 'raise_ticket' && (
        <RaiseTicketView
          onNavigate={handleNavigate}
          activeTrip={activeTrip}
          user={user}
          initialCategory={categoryId}
        />
      )}
      
      {currentView === 'chat' && (
        <SupportAssistantChat 
          onNavigate={handleNavigate} 
          activeTrip={activeTrip} 
          user={user} 
          preloadContext={preloadContext}
          initialQuery={initialQuery}
        />
      )}

      {currentView === 'tickets' && (
        <TicketTracking 
          onNavigate={handleNavigate} 
          user={user} 
        />
      )}

      {currentView === 'ticket_detail' && ticketId && (
        <TicketDetailView 
          onNavigate={handleNavigate} 
          ticketId={ticketId} 
          user={user}
        />
      )}
    </div>
  );
}
