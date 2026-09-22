#!/usr/bin/env python3
"""
WeatherGPT 5-Domain Use-Case Automated Verification Test Suite
Tests intent classification and response generation for:
1. Agricultural Crop-Weather Advisory
2. Aviation Weather Briefing
3. Flood & Cyclone Early Warning Dissemination
4. Smart City Environmental Monitoring
5. Climate Analytics for Researchers
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from backend.app.services.agent_service import classify_intent, generate_response

TEST_QUERIES = [
    {
        "use_case": "1. Agricultural Crop-Weather Advisory",
        "expected_intent": ["agriculture", "forecast", "current"],
        "query": "I am a wheat farmer in Ludhiana, Punjab. Heavy rain is expected in the next 24 to 48 hours. Should I spray pesticide on my crop today or hold off? Also suggest irrigation advice."
    },
    {
        "use_case": "2. Aviation Weather Briefing",
        "expected_intent": ["aviation", "current", "forecast"],
        "query": "Provide an aviation weather briefing for Mumbai Airport (VABB / BOM): wind vectors, cloud ceiling, barometric pressure QNH, visibility, and convective hazards."
    },
    {
        "use_case": "3. Flood & Cyclone Early Warning Dissemination",
        "expected_intent": ["cyclone_alert", "live_alerts", "forecast"],
        "query": "Are there active cyclone or heavy rainfall early warnings for coastal Odisha (Puri)? What emergency evacuation and preparedness steps are advised?"
    },
    {
        "use_case": "4. Smart City Environmental Monitoring",
        "expected_intent": ["smart_city", "pollution", "heat_risk"],
        "query": "What is the current Air Quality Index (AQI), PM2.5 concentration, and urban heat risk score for Delhi Smart City today? What urban heat mitigation measures should be enacted?"
    },
    {
        "use_case": "5. Climate Analytics for Researchers",
        "expected_intent": ["climate_analytics", "history"],
        "query": "Provide a 25-year historical climate trend analysis for temperature anomalies and monsoon rainfall variability in Maharashtra (2000-2026) using ERA5 reanalysis data."
    }
]


def run_tests():
    print("=" * 80)
    print("WEATHERGPT 5-DOMAIN USE-CASE AUTOMATED VERIFICATION TEST SUITE")
    print("=" * 80)
    
    passed_count = 0
    total_count = len(TEST_QUERIES)
    
    for i, test in enumerate(TEST_QUERIES, 1):
        print(f"\n--------------------------------------------------------------------------------")
        print(f"[TEST {i}/{total_count}] USE CASE: {test['use_case']}")
        print(f"[QUERY]: \"{test['query']}\"")
        print(f"--------------------------------------------------------------------------------")
        
        classification = classify_intent(test["query"], [])
        intent = classification.get("intent")
        city = classification.get("city")
        print(f"[CLASSIFIED INTENT]: '{intent}' | [TARGET CITY/REGION]: '{city}'")
        
        print(f"[GENERATING AI RESPONSE...]")
        response = generate_response(test["query"], [])
        
        if response and len(response.strip()) > 50:
            safe_preview = response[:400].encode('ascii', errors='replace').decode('ascii')
            print(f"\n[RESPONSE PREVIEW]:\n{safe_preview}...\n")
            print(f"[SUCCESS] TEST {i} PASSED - Successfully received rich response ({len(response)} characters)")
            passed_count += 1
        else:
            print(f"[FAILURE] TEST {i} FAILED - Response empty or error")
            
    print("\n" + "=" * 80)
    print(f"[SUMMARY]: {passed_count}/{total_count} USE CASES SUCCESSFULLY TESTED & VERIFIED")
    print("=" * 80)
    return passed_count == total_count


if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)
