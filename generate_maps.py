import json

def create_grid(width, height):
    grid = []
    for y in range(height):
        row = []
        for x in range(width):
            if x == 0 or x == width - 1 or y == 0 or y == height - 1:
                row.append(2) # Wall
            else:
                row.append(1) # Floor
        grid.append(row)
    return grid

challenges = [
    ("zone_1_1", "Sector 1.1: Biometrics", "challenge_1_1_biometrics"),
    ("zone_1_2", "Sector 1.2: Neural Pulse", "challenge_1_2_neural_pulse"),
    ("zone_1_3", "Sector 1.3: Safety Protocols", "challenge_1_3_safety_protocols"),
    ("zone_1_4", "Sector 1.4: Repair Kit", "challenge_1_4_repair_kit"),
    ("zone_1_5", "Sector 1.5: Cognitive Registry", "challenge_1_5_cognitive_registry"),
    ("zone_1_6", "Sector 1.6: Boss Sentinel", "challenge_boss_sentinel"),
    ("zone_2_1", "Sector 2.1: Signal Buffers", "challenge_2_1_signal_buffers"),
    ("zone_2_2", "Sector 2.2: Vital Vectorization", "challenge_2_2_vital_vectorization"),
    ("zone_2_3", "Sector 2.3: Buffer Reshaping", "challenge_2_3_buffer_reshaping"),
    ("zone_2_4", "Sector 2.4: Memory Log", "challenge_2_4_memory_log"),
    ("zone_2_5", "Sector 2.5: Null Anomalies", "challenge_2_5_null_anomalies"),
    ("zone_2_6", "Sector 2.6: Hazardous Purge", "challenge_2_6_hazardous_purge"),
    ("zone_2_7", "Sector 2.7: Sector Query", "challenge_2_7_sector_query"),
    ("zone_2_8", "Sector 2.8: Cargo Sorting", "challenge_2_8_cargo_sorting"),
    ("zone_2_9", "Sector 2.9: Integrity Audit", "challenge_2_9_integrity_audit"),
    ("zone_2_10", "Sector 2.10: Boss Labyrinth", "challenge_boss_labyrinth")
]

maps = []
grid = create_grid(20, 10)

for i, (zone_id, name, chal_id) in enumerate(challenges):
    entities = [
        {"type": "terminal", "x": 640, "y": 320, "challengeId": chal_id}
    ]
    
    # Forward Portal
    if i < len(challenges) - 1:
        entities.append({
            "type": "portal",
            "x": 896,
            "y": 320,
            "targetMapId": challenges[i+1][0],
            "color": "#00e5ff" # Cyan
        })
        
    # Reverse Portal
    if i > 0:
        entities.append({
            "type": "portal",
            "x": 128,
            "y": 320,
            "targetMapId": challenges[i-1][0],
            "color": "#a855f7" # Purple
        })

    map_data = {
        "id": zone_id,
        "name": name,
        "width": 20,
        "height": 10,
        "playerStart": {"x": 320, "y": 320},
        "grid": grid,
        "entities": entities
    }
    maps.append(map_data)

with open('data/maps.json', 'w') as f:
    json.dump({"maps": maps}, f, indent=2)

print("Generated maps.json")
