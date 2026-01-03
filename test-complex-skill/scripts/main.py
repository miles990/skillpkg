#!/usr/bin/env python3
"""Main entry point for complex-test skill."""
import argparse
import json
from utils.helpers.formatter import format_output

def main():
    parser = argparse.ArgumentParser(description="Complex test skill")
    parser.add_argument("--config", required=True, help="Config file path")
    args = parser.parse_args()

    with open(args.config) as f:
        config = json.load(f)

    print(format_output(f"Loaded config: {config['name']}"))
    print("✅ Complex skill executed successfully!")

if __name__ == "__main__":
    main()
