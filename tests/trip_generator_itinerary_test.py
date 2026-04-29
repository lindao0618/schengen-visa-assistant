import os
import sys
import unittest
from datetime import datetime, timedelta
from pathlib import Path

os.environ.setdefault("DEEPSEEK_API_KEY", "test-key")

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT / "app" / "trip_generator"))

import main  # noqa: E402


class TripGeneratorItineraryTest(unittest.TestCase):
    def test_parse_attractions_accepts_common_date_formats(self):
        result = main.parse_attractions(
            "\n".join(
                [
                    "2026-06-15: Louvre Museum, Seine River Walk",
                    "16/06/2026 - Eiffel Tower, Montmartre",
                    "2026/06/17：Palace of Versailles",
                ]
            )
        )

        self.assertEqual(result["15/06/2026"], "Louvre Museum, Seine River Walk")
        self.assertEqual(result["16/06/2026"], "Eiffel Tower, Montmartre")
        self.assertEqual(result["17/06/2026"], "Palace of Versailles")

    def test_build_itinerary_rows_never_leaves_middle_day_attractions_empty(self):
        start_date = datetime.strptime("2026-06-14", "%Y-%m-%d")
        rows = main.build_itinerary_rows(
            start_date=start_date,
            days=4,
            departure_city="Beijing",
            arrival_city="Paris",
            hotel_name="Test Hotel",
            hotel_address="1 Rue Test",
            hotel_phone="+33 1 00 00 00 00",
            daily_spots={},
        )

        middle_days = rows[1:-1]
        self.assertEqual(len(middle_days), 2)
        for offset, row in enumerate(middle_days, start=1):
            expected_date = (start_date + timedelta(days=offset)).strftime("%d/%m/%Y")
            self.assertEqual(row[1], expected_date)
            self.assertTrue(row[3].strip())
            self.assertNotIn("Arrival Day", row[3])
            self.assertNotIn("Departure Day", row[3])


if __name__ == "__main__":
    unittest.main()
