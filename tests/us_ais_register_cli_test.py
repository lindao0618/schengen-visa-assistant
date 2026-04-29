import sys
import unittest
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT / "services" / "us-ais-register"))

import us_ais_register_cli  # noqa: E402


class FakeLocator:
    def __init__(self, text: str = ""):
        self.text = text

    def inner_text(self, timeout: int = 0) -> str:
        return self.text


class FakePage:
    def __init__(self, html: str, url: str = "https://ais.usvisa-info.com/en-gb/niv/users/confirmation"):
        self.html = html
        self.url = url

    def content(self) -> str:
        return self.html

    def locator(self, selector: str):
        if selector == "body":
            return FakeLocator(self.html)
        return FakeLocator("")


class UsAisRegisterCliTest(unittest.TestCase):
    def test_detects_activation_email_sent_page_as_success_state(self):
        page = FakePage(
            """
            <h1>Activate Your Account</h1>
            <p>You have created an account for the following email address:</p>
            <strong>wddctdk06@gmail.com</strong>
            <p>To activate your account, you need to follow the instructions provided in the email.</p>
            <a>Resend email</a>
            """
        )

        self.assertTrue(us_ais_register_cli._is_ais_activation_email_sent_page(page))

    def test_does_not_treat_generic_page_as_activation_email_sent(self):
        page = FakePage("<h1>New Applicant</h1><button>Create Applicant</button>")

        self.assertFalse(us_ais_register_cli._is_ais_activation_email_sent_page(page))

    def test_detects_email_taken_signup_failure_text(self):
        message = us_ais_register_cli._detect_known_signup_failure_text(
            """
            Signup
            Email has already been taken
            Password can't be blank
            """
        )

        self.assertIn("Email has already been taken", message)


if __name__ == "__main__":
    unittest.main()
