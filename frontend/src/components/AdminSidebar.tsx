import React, { useState } from 'react';
import { Nav, Button } from 'react-bootstrap';
import { Link, useLocation } from 'react-router-dom';
import './AdminSidebar.css';

interface AdminSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

const AdminSidebar: React.FC<AdminSidebarProps> = ({ isOpen, onToggle }) => {
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path;

  return (
    <>
      {/* Sidebar */}
      <div className={`admin-sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <h5 className="mb-0">Admin Panel</h5>
          <Button 
            variant="link" 
            className="close-btn" 
            onClick={onToggle}
          >
            <i className="bi bi-x-lg"></i>
          </Button>
        </div>

        <Nav className="flex-column sidebar-nav">
          {/* Procurement Section */}
          <div className="sidebar-section">
            <h6 className="sidebar-section-title">
              <i className="bi bi-cart-check me-2"></i>
              Procurement
            </h6>
            <Nav.Link 
              as={Link} 
              to="/purchase-request-canvasser" 
              active={isActive('/purchase-request-canvasser')}
              className="sidebar-item"
            >
              <i className="bi bi-file-earmark-plus me-2"></i>
              Purchase Request
            </Nav.Link>
            <Nav.Link 
              as={Link} 
              to="/abstract-of-canvass" 
              active={isActive('/abstract-of-canvass')}
              className="sidebar-item"
            >
              <i className="bi bi-file-earmark-text me-2"></i>
              Abstract of Canvass
            </Nav.Link>
            <Nav.Link 
              as={Link} 
              to="/orders" 
              active={isActive('/orders')}
              className="sidebar-item"
            >
              <i className="bi bi-cart me-2"></i>
              Purchase Order
            </Nav.Link>
            <Nav.Link 
              as={Link} 
              to="/supplier-search" 
              active={isActive('/supplier-search')}
              className="sidebar-item"
            >
              <i className="bi bi-search me-2"></i>
              Supplier Search
            </Nav.Link>
          </div>

          {/* Inventory Section */}
          <div className="sidebar-section">
            <h6 className="sidebar-section-title">
              <i className="bi bi-boxes me-2"></i>
              Inventory
            </h6>
            <Nav.Link 
              as={Link} 
              to="/inventory-custodian-slip" 
              active={isActive('/inventory-custodian-slip')}
              className="sidebar-item"
            >
              <i className="bi bi-file-earmark-text me-2"></i>
              Custodian Slip
            </Nav.Link>
            <Nav.Link 
              as={Link} 
              to="/inventory-transfer-report" 
              active={isActive('/inventory-transfer-report')}
              className="sidebar-item"
            >
              <i className="bi bi-arrow-left-right me-2"></i>
              Transfer Report
            </Nav.Link>
            <Nav.Link 
              as={Link} 
              to="/property-acknowledgement-receipt" 
              active={isActive('/property-acknowledgement-receipt')}
              className="sidebar-item"
            >
              <i className="bi bi-receipt me-2"></i>
              Acknowledgement Receipt
            </Nav.Link>
          </div>

          {/* Reports Section */}
          <div className="sidebar-section">
            <h6 className="sidebar-section-title">
              <i className="bi bi-file-earmark-bar-graph me-2"></i>
              Reports
            </h6>
            <Nav.Link 
              as={Link} 
              to="/property-transfer-report" 
              active={isActive('/property-transfer-report')}
              className="sidebar-item"
            >
              <i className="bi bi-file-earmark-text me-2"></i>
              Property Transfer
            </Nav.Link>
            <Nav.Link 
              as={Link} 
              to="/property-return-slip" 
              active={isActive('/property-return-slip')}
              className="sidebar-item"
            >
              <i className="bi bi-file-earmark-text me-2"></i>
              Property Return Slip
            </Nav.Link>
            <Nav.Link 
              as={Link} 
              to="/waste-materials-report" 
              active={isActive('/waste-materials-report')}
              className="sidebar-item"
            >
              <i className="bi bi-exclamation-triangle me-2"></i>
              Waste Materials
            </Nav.Link>
          </div>

          {/* Operations Section */}
          <div className="sidebar-section">
            <h6 className="sidebar-section-title">
              <i className="bi bi-gear me-2"></i>
              Operations
            </h6>
            <Nav.Link 
              as={Link} 
              to="/blockchain" 
              active={isActive('/blockchain')}
              className="sidebar-item"
            >
              <i className="bi bi-link-45deg me-2"></i>
              Blockchain
            </Nav.Link>
            <Nav.Link 
              as={Link} 
              to="/inspection" 
              active={isActive('/inspection')}
              className="sidebar-item"
            >
              <i className="bi bi-clipboard-check me-2"></i>
              Inspection
            </Nav.Link>
          </div>
        </Nav>
      </div>

      {/* Sidebar Overlay */}
      {isOpen && <div className="sidebar-overlay" onClick={onToggle}></div>}
    </>
  );
};

export default AdminSidebar;
