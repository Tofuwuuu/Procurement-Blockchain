import React from 'react';
import { Card } from 'react-bootstrap';

interface CardStatProps {
  title: string;
  value: number;
  icon: string;
  variant?: 'primary' | 'success' | 'warning' | 'danger' | 'info';
  className?: string;
  helperText?: string;
}

const CardStat: React.FC<CardStatProps> = ({ 
  title, 
  value, 
  icon, 
  variant = 'primary',
  className = '',
  helperText
}) => {
  const getVariantClasses = () => {
    return `stat-card-modern stat-card-${variant}`;
  };

  return (
    <Card className={`${getVariantClasses()} ${className}`}>
      <Card.Body>
        <div className="stat-card-content">
          <div className="stat-copy">
            <div className="stat-title">{title}</div>
            <div className="stat-value">{value.toLocaleString()}</div>
            {helperText && <div className="stat-helper">{helperText}</div>}
          </div>
          <div className="stat-icon" aria-hidden="true">
            <i className={`bi ${icon}`}></i>
          </div>
        </div>
      </Card.Body>
    </Card>
  );
};

export default CardStat;
