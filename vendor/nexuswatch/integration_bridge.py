#!/usr/bin/env python3
"""
NexusWatch Integration Bridge
Connects HoneyTrap and SentinelForge to the SIEM Dashboard

This script:
1. Monitors HoneyTrap event files for new security events
2. Enriches events with SentinelForge IOC data
3. Forwards normalized events to NexusWatch
"""

import json
import time
import hashlib
import logging
import argparse
import requests
from pathlib import Path
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, asdict, field

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s | %(levelname)-8s | %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger('nexuswatch-bridge')


# ============================================================================
# Configuration
# ============================================================================

@dataclass
class Config:
    """Integration configuration"""
    honeytrap_events_dir: str = "./honeytrap/events"
    sentinelforge_api: str = "http://localhost:3001"
    nexuswatch_api: str = "http://localhost:3000"
    poll_interval: int = 5  # seconds
    batch_size: int = 50
    enable_enrichment: bool = True


# ============================================================================
# Event Models
# ============================================================================

@dataclass
class NormalizedEvent:
    """Standardized security event format for NexusWatch"""
    id: str
    timestamp: str
    type: str
    severity: str
    source: str
    source_ip: str
    dest_ip: str
    dest_port: int
    status: str
    details: str
    ioc_match: bool = False
    threat_score: int = 50
    raw_data: Dict = field(default_factory=dict)
    enrichment: Dict = field(default_factory=dict)

    def to_nexuswatch_format(self) -> Dict:
        """Convert to NexusWatch API format"""
        return {
            "id": self.id,
            "timestamp": self.timestamp,
            "type": self.type,
            "severity": self.severity,
            "source": self.source,
            "sourceIp": self.source_ip,
            "destIp": self.dest_ip,
            "destPort": self.dest_port,
            "status": self.status,
            "details": self.details,
            "iocMatch": self.ioc_match,
            "threatScore": self.threat_score,
            "enrichment": self.enrichment
        }


# ============================================================================
# Event Type Mapping
# ============================================================================

HONEYTRAP_EVENT_MAPPING = {
    "connection": {
        "type": "SUSPICIOUS_CONNECTION",
        "severity": "low",
        "base_score": 30
    },
    "authentication_attempt": {
        "type": "BRUTE_FORCE",
        "severity": "high",
        "base_score": 70
    },
    "authentication_success": {
        "type": "UNAUTHORIZED_ACCESS",
        "severity": "critical",
        "base_score": 95
    },
    "command_execution": {
        "type": "MALICIOUS_COMMAND",
        "severity": "critical",
        "base_score": 90
    },
    "file_download": {
        "type": "MALWARE_DOWNLOAD",
        "severity": "critical",
        "base_score": 95
    },
    "port_scan": {
        "type": "PORT_SCAN",
        "severity": "low",
        "base_score": 25
    },
    "ssh_brute_force": {
        "type": "BRUTE_FORCE",
        "severity": "high",
        "base_score": 75
    },
    "http_attack": {
        "type": "WEB_ATTACK",
        "severity": "high",
        "base_score": 70
    },
    "sql_injection": {
        "type": "SQL_INJECTION",
        "severity": "critical",
        "base_score": 90
    },
    "xss_attempt": {
        "type": "XSS_ATTEMPT",
        "severity": "high",
        "base_score": 70
    },
    "default": {
        "type": "ANOMALOUS_ACTIVITY",
        "severity": "medium",
        "base_score": 50
    }
}


# ============================================================================
# SentinelForge Enrichment
# ============================================================================

class SentinelForgeClient:
    """Client for SentinelForge threat intelligence API"""
    
    def __init__(self, api_url: str):
        self.api_url = api_url.rstrip('/')
        self.session = requests.Session()
        self.cache: Dict[str, Dict] = {}
        self.cache_ttl = 300  # 5 minutes
        self.cache_timestamps: Dict[str, float] = {}
    
    def _is_cache_valid(self, key: str) -> bool:
        """Check if cached entry is still valid"""
        if key not in self.cache_timestamps:
            return False
        return (time.time() - self.cache_timestamps[key]) < self.cache_ttl
    
    def lookup_ip(self, ip: str) -> Optional[Dict]:
        """Look up IP in SentinelForge IOC database"""
        cache_key = f"ip:{ip}"
        
        if self._is_cache_valid(cache_key):
            return self.cache.get(cache_key)
        
        try:
            response = self.session.get(
                f"{self.api_url}/api/iocs/search",
                params={"type": "ip", "value": ip},
                timeout=5
            )
            
            if response.status_code == 200:
                data = response.json()
                self.cache[cache_key] = data
                self.cache_timestamps[cache_key] = time.time()
                return data
            
        except requests.RequestException as e:
            logger.warning(f"SentinelForge lookup failed for {ip}: {e}")
        
        return None
    
    def get_threat_intel(self, ip: str) -> Dict:
        """Get comprehensive threat intelligence for an IP"""
        result = {
            "is_known_threat": False,
            "threat_types": [],
            "confidence": 0,
            "tags": [],
            "first_seen": None,
            "last_seen": None,
            "sources": []
        }
        
        ioc_data = self.lookup_ip(ip)
        
        if ioc_data and ioc_data.get("matches"):
            matches = ioc_data["matches"]
            result["is_known_threat"] = True
            result["confidence"] = max(m.get("confidence", 50) for m in matches)
            
            for match in matches:
                if match.get("threat_type"):
                    result["threat_types"].append(match["threat_type"])
                if match.get("tags"):
                    result["tags"].extend(match["tags"])
                if match.get("source"):
                    result["sources"].append(match["source"])
            
            result["threat_types"] = list(set(result["threat_types"]))
            result["tags"] = list(set(result["tags"]))
            result["sources"] = list(set(result["sources"]))
        
        return result


# ============================================================================
# Event Processor
# ============================================================================

class EventProcessor:
    """Processes and normalizes security events"""
    
    def __init__(self, config: Config):
        self.config = config
        self.sentinelforge = SentinelForgeClient(config.sentinelforge_api) if config.enable_enrichment else None
        self.processed_ids: set = set()
    
    def generate_event_id(self, event: Dict) -> str:
        """Generate unique event ID based on content"""
        content = json.dumps(event, sort_keys=True)
        hash_input = f"{content}:{time.time_ns()}"
        return f"EVT-{hashlib.sha256(hash_input.encode()).hexdigest()[:12].upper()}"
    
    def calculate_threat_score(self, event: NormalizedEvent, enrichment: Dict) -> int:
        """Calculate final threat score based on event and enrichment"""
        score = event.threat_score
        
        # Boost score if known threat
        if enrichment.get("is_known_threat"):
            score += 20
            score = min(100, score + enrichment.get("confidence", 0) // 5)
        
        # Boost for specific threat types
        high_risk_types = ["botnet", "c2", "ransomware", "apt"]
        for threat_type in enrichment.get("threat_types", []):
            if any(rt in threat_type.lower() for rt in high_risk_types):
                score += 15
                break
        
        return min(100, score)
    
    def normalize_honeytrap_event(self, raw_event: Dict) -> Optional[NormalizedEvent]:
        """Convert HoneyTrap event to normalized format"""
        try:
            event_type = raw_event.get("event_type", "default")
            mapping = HONEYTRAP_EVENT_MAPPING.get(event_type, HONEYTRAP_EVENT_MAPPING["default"])
            
            # Determine source based on honeypot service
            service = raw_event.get("service", "unknown")
            source = f"HoneyTrap-{service.upper()}"
            
            # Extract IPs
            source_ip = raw_event.get("source_ip") or raw_event.get("attacker_ip") or "0.0.0.0"
            dest_ip = raw_event.get("dest_ip") or raw_event.get("honeypot_ip") or "10.0.0.1"
            dest_port = raw_event.get("dest_port") or raw_event.get("port") or 0
            
            # Build details string
            details_parts = []
            if raw_event.get("username"):
                details_parts.append(f"User: {raw_event['username']}")
            if raw_event.get("command"):
                details_parts.append(f"Cmd: {raw_event['command'][:100]}")
            if raw_event.get("payload"):
                details_parts.append(f"Payload detected")
            if raw_event.get("user_agent"):
                details_parts.append(f"UA: {raw_event['user_agent'][:50]}")
            
            details = " | ".join(details_parts) if details_parts else f"Detected {mapping['type'].lower().replace('_', ' ')}"
            
            # Parse timestamp
            timestamp = raw_event.get("timestamp")
            if not timestamp:
                timestamp = datetime.now(timezone.utc).isoformat()
            
            event = NormalizedEvent(
                id=self.generate_event_id(raw_event),
                timestamp=timestamp,
                type=mapping["type"],
                severity=mapping["severity"],
                source=source,
                source_ip=source_ip,
                dest_ip=dest_ip,
                dest_port=int(dest_port),
                status="active",
                details=details,
                threat_score=mapping["base_score"],
                raw_data=raw_event
            )
            
            return event
            
        except Exception as e:
            logger.error(f"Failed to normalize event: {e}")
            return None
    
    def enrich_event(self, event: NormalizedEvent) -> NormalizedEvent:
        """Enrich event with threat intelligence"""
        if not self.sentinelforge:
            return event
        
        try:
            intel = self.sentinelforge.get_threat_intel(event.source_ip)
            event.enrichment = intel
            event.ioc_match = intel.get("is_known_threat", False)
            event.threat_score = self.calculate_threat_score(event, intel)
            
            # Upgrade severity if high-confidence IOC match
            if intel.get("is_known_threat") and intel.get("confidence", 0) > 80:
                if event.severity == "low":
                    event.severity = "medium"
                elif event.severity == "medium":
                    event.severity = "high"
            
        except Exception as e:
            logger.warning(f"Enrichment failed for {event.source_ip}: {e}")
        
        return event
    
    def process_event(self, raw_event: Dict) -> Optional[NormalizedEvent]:
        """Full processing pipeline for a single event"""
        # Normalize
        event = self.normalize_honeytrap_event(raw_event)
        if not event:
            return None
        
        # Check for duplicates
        event_hash = hashlib.md5(json.dumps(raw_event, sort_keys=True).encode()).hexdigest()
        if event_hash in self.processed_ids:
            return None
        self.processed_ids.add(event_hash)
        
        # Limit cache size
        if len(self.processed_ids) > 10000:
            self.processed_ids = set(list(self.processed_ids)[-5000:])
        
        # Enrich
        event = self.enrich_event(event)
        
        return event


# ============================================================================
# NexusWatch Client
# ============================================================================

class NexusWatchClient:
    """Client for sending events to NexusWatch SIEM"""
    
    def __init__(self, api_url: str):
        self.api_url = api_url.rstrip('/')
        self.session = requests.Session()
    
    def send_event(self, event: NormalizedEvent) -> bool:
        """Send single event to NexusWatch"""
        try:
            response = self.session.post(
                f"{self.api_url}/api/events",
                json=event.to_nexuswatch_format(),
                timeout=10
            )
            return response.status_code in (200, 201, 202)
        except requests.RequestException as e:
            logger.error(f"Failed to send event to NexusWatch: {e}")
            return False
    
    def send_batch(self, events: List[NormalizedEvent]) -> int:
        """Send batch of events to NexusWatch"""
        try:
            payload = [e.to_nexuswatch_format() for e in events]
            response = self.session.post(
                f"{self.api_url}/api/events/batch",
                json={"events": payload},
                timeout=30
            )
            if response.status_code in (200, 201, 202):
                return len(events)
            return 0
        except requests.RequestException as e:
            logger.error(f"Failed to send batch to NexusWatch: {e}")
            return 0


# ============================================================================
# File Monitor
# ============================================================================

class HoneyTrapMonitor:
    """Monitors HoneyTrap event files for new events"""
    
    def __init__(self, events_dir: str, processor: EventProcessor, nexuswatch: NexusWatchClient):
        self.events_dir = Path(events_dir)
        self.processor = processor
        self.nexuswatch = nexuswatch
        self.file_positions: Dict[str, int] = {}
    
    def scan_events_file(self, filepath: Path) -> List[Dict]:
        """Read new events from a JSONL file"""
        events = []
        str_path = str(filepath)
        
        try:
            current_pos = self.file_positions.get(str_path, 0)
            
            with open(filepath, 'r') as f:
                f.seek(current_pos)
                for line in f:
                    line = line.strip()
                    if line:
                        try:
                            events.append(json.loads(line))
                        except json.JSONDecodeError:
                            continue
                
                self.file_positions[str_path] = f.tell()
        
        except Exception as e:
            logger.error(f"Error reading {filepath}: {e}")
        
        return events
    
    def scan_all_files(self) -> List[Dict]:
        """Scan all event files in the directory"""
        all_events = []
        
        if not self.events_dir.exists():
            return all_events
        
        for filepath in self.events_dir.glob("*.jsonl"):
            events = self.scan_events_file(filepath)
            all_events.extend(events)
        
        # Also check for .json files (array format)
        for filepath in self.events_dir.glob("*.json"):
            try:
                with open(filepath, 'r') as f:
                    data = json.load(f)
                    if isinstance(data, list):
                        all_events.extend(data)
            except Exception as e:
                logger.error(f"Error reading {filepath}: {e}")
        
        return all_events
    
    def process_and_forward(self) -> int:
        """Process new events and forward to NexusWatch"""
        raw_events = self.scan_all_files()
        
        if not raw_events:
            return 0
        
        processed = []
        for raw_event in raw_events:
            event = self.processor.process_event(raw_event)
            if event:
                processed.append(event)
        
        if not processed:
            return 0
        
        # Send to NexusWatch
        sent = 0
        for event in processed:
            if self.nexuswatch.send_event(event):
                sent += 1
                logger.info(f"→ {event.type} | {event.source_ip} | Score: {event.threat_score} | IOC: {event.ioc_match}")
        
        return sent


# ============================================================================
# Main Loop
# ============================================================================

def run_bridge(config: Config):
    """Main integration bridge loop"""
    logger.info("=" * 60)
    logger.info("NexusWatch Integration Bridge")
    logger.info("=" * 60)
    logger.info(f"HoneyTrap Events: {config.honeytrap_events_dir}")
    logger.info(f"SentinelForge API: {config.sentinelforge_api}")
    logger.info(f"NexusWatch API: {config.nexuswatch_api}")
    logger.info(f"Poll Interval: {config.poll_interval}s")
    logger.info(f"Enrichment: {'Enabled' if config.enable_enrichment else 'Disabled'}")
    logger.info("=" * 60)
    
    processor = EventProcessor(config)
    nexuswatch = NexusWatchClient(config.nexuswatch_api)
    monitor = HoneyTrapMonitor(config.honeytrap_events_dir, processor, nexuswatch)
    
    logger.info("Starting event monitoring loop...")
    
    total_processed = 0
    try:
        while True:
            processed = monitor.process_and_forward()
            if processed > 0:
                total_processed += processed
                logger.info(f"Processed {processed} events (Total: {total_processed})")
            
            time.sleep(config.poll_interval)
    
    except KeyboardInterrupt:
        logger.info(f"\nShutting down. Total events processed: {total_processed}")


def main():
    parser = argparse.ArgumentParser(
        description="NexusWatch Integration Bridge - Connect HoneyTrap to SIEM"
    )
    parser.add_argument(
        "--honeytrap-dir",
        default="./honeytrap/events",
        help="Directory containing HoneyTrap event files"
    )
    parser.add_argument(
        "--sentinelforge",
        default="http://localhost:3001",
        help="SentinelForge API URL"
    )
    parser.add_argument(
        "--nexuswatch",
        default="http://localhost:3000",
        help="NexusWatch API URL"
    )
    parser.add_argument(
        "--interval",
        type=int,
        default=5,
        help="Poll interval in seconds"
    )
    parser.add_argument(
        "--no-enrichment",
        action="store_true",
        help="Disable SentinelForge enrichment"
    )
    
    args = parser.parse_args()
    
    config = Config(
        honeytrap_events_dir=args.honeytrap_dir,
        sentinelforge_api=args.sentinelforge,
        nexuswatch_api=args.nexuswatch,
        poll_interval=args.interval,
        enable_enrichment=not args.no_enrichment
    )
    
    run_bridge(config)


if __name__ == "__main__":
    main()
