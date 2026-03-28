// Health Check Utility
// Runtime checks to ensure all services are operational

import { supabase } from '../api/supabase';
import { CONFIG } from '../config';
import * as Location from 'expo-location';
import { Platform } from 'react-native';

export interface HealthCheckResult {
  service: string;
  status: 'ok' | 'warning' | 'error';
  latency?: number;
  message?: string;
}

export interface HealthReport {
  timestamp: string;
  overall: 'healthy' | 'degraded' | 'unhealthy';
  checks: HealthCheckResult[];
  platform: string;
  appVersion: string;
}

/**
 * Check if Supabase is reachable and responding
 */
export async function checkSupabase(): Promise<HealthCheckResult> {
  const start = Date.now();
  try {
    const { error } = await supabase
      .from('users')
      .select('id')
      .limit(1)
      .maybeSingle();
    
    const latency = Date.now() - start;
    
    if (error) {
      // RLS might block, but connection works
      if (error.code === 'PGRST116') {
        return { service: 'Supabase', status: 'ok', latency, message: 'Connected (no data)' };
      }
      return { service: 'Supabase', status: 'warning', latency, message: error.message };
    }
    
    return { service: 'Supabase', status: 'ok', latency };
  } catch (error: any) {
    return { 
      service: 'Supabase', 
      status: 'error', 
      message: error.message || 'Connection failed' 
    };
  }
}

/**
 * Check if Google Maps API is configured and responding
 */
export async function checkGoogleMaps(): Promise<HealthCheckResult> {
  if (!CONFIG.GOOGLE_MAPS_API_KEY) {
    return { 
      service: 'Google Maps', 
      status: 'warning', 
      message: 'API key not configured' 
    };
  }
  
  // Basic format check
  if (!CONFIG.GOOGLE_MAPS_API_KEY.startsWith('AIza')) {
    return { 
      service: 'Google Maps', 
      status: 'error', 
      message: 'Invalid API key format' 
    };
  }
  
  const start = Date.now();
  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=-17.8292,31.0522&key=${CONFIG.GOOGLE_MAPS_API_KEY}`
    );
    const latency = Date.now() - start;
    const data = await response.json();
    
    if (data.error_message) {
      return { 
        service: 'Google Maps', 
        status: 'error', 
        latency,
        message: data.error_message 
      };
    }
    
    return { service: 'Google Maps', status: 'ok', latency };
  } catch (error: any) {
    return { 
      service: 'Google Maps', 
      status: 'error', 
      message: error.message || 'API request failed' 
    };
  }
}

/**
 * Check location permissions
 */
export async function checkLocationPermissions(): Promise<HealthCheckResult> {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    
    if (status === 'granted') {
      return { service: 'Location', status: 'ok', message: 'Permission granted' };
    } else if (status === 'undetermined') {
      return { service: 'Location', status: 'warning', message: 'Permission not yet requested' };
    } else {
      return { service: 'Location', status: 'error', message: 'Permission denied' };
    }
  } catch (error: any) {
    return { 
      service: 'Location', 
      status: 'error', 
      message: error.message || 'Permission check failed' 
    };
  }
}

/**
 * Check PayNow configuration
 */
export function checkPayNow(): HealthCheckResult {
  const hasId = !!CONFIG.PAYNOW_ID;
  const hasKey = !!CONFIG.PAYNOW_KEY;
  
  if (hasId && hasKey) {
    return { service: 'PayNow', status: 'ok', message: 'Configured' };
  } else if (hasId || hasKey) {
    return { service: 'PayNow', status: 'warning', message: 'Partially configured' };
  } else {
    return { service: 'PayNow', status: 'warning', message: 'Not configured' };
  }
}

/**
 * Run all health checks
 */
export async function runHealthCheck(): Promise<HealthReport> {
  const checks: HealthCheckResult[] = [];
  
  // Run checks in parallel where possible
  const [supabaseCheck, mapsCheck, locationCheck] = await Promise.all([
    checkSupabase(),
    checkGoogleMaps(),
    checkLocationPermissions(),
  ]);
  
  checks.push(supabaseCheck);
  checks.push(mapsCheck);
  checks.push(locationCheck);
  checks.push(checkPayNow());
  
  // Determine overall health
  const hasError = checks.some(c => c.status === 'error');
  const hasWarning = checks.some(c => c.status === 'warning');
  
  let overall: HealthReport['overall'] = 'healthy';
  if (hasError) {
    overall = 'unhealthy';
  } else if (hasWarning) {
    overall = 'degraded';
  }
  
  return {
    timestamp: new Date().toISOString(),
    overall,
    checks,
    platform: Platform.OS,
    appVersion: CONFIG.APP_NAME || '1.0.0',
  };
}

/**
 * Format health report for logging
 */
export function formatHealthReport(report: HealthReport): string {
  const statusEmoji = {
    ok: '✅',
    warning: '⚠️',
    error: '❌',
  };
  
  const overallEmoji = {
    healthy: '💚',
    degraded: '💛',
    unhealthy: '❤️',
  };
  
  const lines = [
    `\n${overallEmoji[report.overall]} Health Check: ${report.overall.toUpperCase()}`,
    `📱 Platform: ${report.platform}`,
    `⏰ Time: ${report.timestamp}`,
    '─'.repeat(40),
  ];
  
  report.checks.forEach(check => {
    const latencyStr = check.latency ? ` (${check.latency}ms)` : '';
    const messageStr = check.message ? `: ${check.message}` : '';
    lines.push(`${statusEmoji[check.status]} ${check.service}${latencyStr}${messageStr}`);
  });
  
  return lines.join('\n');
}

/**
 * Quick check - just tests critical services
 */
export async function quickHealthCheck(): Promise<boolean> {
  try {
    const supabase = await checkSupabase();
    return supabase.status !== 'error';
  } catch {
    return false;
  }
}



