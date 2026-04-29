import sys
import unittest
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT / "services" / "french-visa"))

import application_generator  # noqa: E402


class FakeDriver:
    def __init__(self, url: str, page_source: str):
        self.current_url = url
        self.page_source = page_source


class FranceVisaApplicationGeneratorTest(unittest.TestCase):
    def test_detects_france_visas_duplicate_tab_lock_page(self):
        driver = FakeDriver(
            "https://application-form.france-visas.gouv.fr/fv-fo-dde/login-error",
            """
            <title>France-Visas - Page 403</title>
            <p>Connection refused, the application is open in another tab.</p>
            <p>连接被拒绝，应用程序在另一个标签页中打开。</p>
            """,
        )

        self.assertTrue(application_generator._france_visas_duplicate_tab_lock_detected(driver))

    def test_does_not_treat_normal_accueil_page_as_duplicate_tab_lock(self):
        driver = FakeDriver(
            "https://application-form.france-visas.gouv.fr/fv-fo-dde/accueil.xhtml",
            "<span>Create a new application in a new group of applications</span>",
        )

        self.assertFalse(application_generator._france_visas_duplicate_tab_lock_detected(driver))


if __name__ == "__main__":
    unittest.main()
