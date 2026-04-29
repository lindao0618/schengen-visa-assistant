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


class RecordingDriver:
    def __init__(self, result):
        self.result = result
        self.calls = []

    def execute_script(self, script: str, *args):
        self.calls.append((script, args))
        return self.result


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

    def test_primefaces_native_select_sets_hidden_select_by_label(self):
        driver = RecordingDriver({"ok": True, "selectedText": "Ordinary passport"})

        ok = application_generator._primefaces_native_select_by_label(
            driver,
            "formStep1:Visas-dde-travel-document_input",
            "formStep1:Visas-dde-travel-document_label",
            "Ordinary passport",
        )

        self.assertTrue(ok)
        self.assertEqual(driver.calls[0][1][0], "formStep1:Visas-dde-travel-document_input")
        self.assertEqual(driver.calls[0][1][1], "formStep1:Visas-dde-travel-document_label")
        self.assertIn("Ordinary passport", driver.calls[0][1][2])

    def test_step_one_early_dropdowns_use_resilient_primefaces_selector(self):
        source = (PROJECT_ROOT / "services" / "french-visa" / "application_generator.py").read_text(encoding="utf-8")

        for input_id in [
            "formStep1:visas-selected-nationality_input",
            "formStep1:Visas-selected-deposit-country_input",
            "formStep1:Visas-selected-stayDuration_input",
            "formStep1:Visas-selected-destination_input",
        ]:
            self.assertIn(input_id, source)

        self.assertNotIn("//li[@data-label='Chinese']", source)


if __name__ == "__main__":
    unittest.main()
