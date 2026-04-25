"""
法签生成新申请功能
从原始代码复制并适配
"""
import os
import sys
import time
import json
import re
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional, Callable, Dict, Any

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import pandas as pd

try:
    from . import config
    from .automation import FrenchVisaAutomation
except ImportError:
    import config
    from automation import FrenchVisaAutomation


def extract_reference_number(text: str) -> Optional[str]:
    """
    从文本中提取法国签证申请参考号
    参考号格式：FRA + 字母数字组合，通常长度在 15-20 个字符
    例如：FRA1MC20267005531
    
    Args:
        text: 包含参考号的文本（可能包含额外描述）
        例如：'FRA1MC20267005531 France Short-stay (≤ 90 days) To be completed'
    
    Returns:
        提取的参考号，如果未找到则返回 None
        例如：'FRA1MC20267005531'
    """
    if not text:
        return None
    
    # 清理文本（移除换行符、制表符等）
    text = text.strip()
    text = ' '.join(text.split())  # 移除多余空格
    
    # 方法1: 如果文本以 FRA 开头，取第一个空格前的部分（最简单直接）
    if text.startswith('FRA'):
        parts = text.split()
        if parts:
            ref = parts[0]
            # 验证参考号格式：FRA + 字母数字组合，长度在 15-20 字符之间
            if re.match(r'^FRA[A-Z0-9]+$', ref) and 15 <= len(ref) <= 20:
                return ref
    
    # 方法2: 使用正则表达式匹配 FRA 开头的参考号格式
    # 格式：FRA + 字母数字组合（总长度通常在 15-20 字符）
    pattern = r'\bFRA[A-Z0-9]{12,17}\b'
    match = re.search(pattern, text, re.IGNORECASE)
    if match:
        ref = match.group(0).upper()  # 转换为大写
        # 验证参考号长度（通常在 15-20 字符之间）
        if 15 <= len(ref) <= 20:
            return ref
    
    # 方法3: 更宽松的匹配，查找所有可能的参考号模式
    # 匹配 FRA 后跟字母数字组合的模式（不限制长度，但验证长度）
    pattern2 = r'\bFRA[0-9A-Z]{10,20}\b'
    matches = re.findall(pattern2, text, re.IGNORECASE)
    for match in matches:
        ref = match.upper()
        # 验证参考号格式和长度
        if re.match(r'^FRA[A-Z0-9]+$', ref) and 15 <= len(ref) <= 20:
            return ref
    
    return None


def _normalize_france_visas_uk_deposit_city(raw: Any) -> str:
    """
    与前端 lib/france-tls-city.ts 对齐：Excel 常见中文/代码 → France-Visas 英国 TLS 下拉 data-label。
    """
    if raw is None or (isinstance(raw, float) and pd.isna(raw)):
        raise ValueError(
            "递签城市（Visa submission city）为空，请填写伦敦/曼彻斯特/爱丁堡，或 LON / MNC / EDI"
        )
    s = str(raw).strip()
    if not s or s.lower() == "nan":
        raise ValueError(
            "递签城市（Visa submission city）为空，请填写伦敦/曼彻斯特/爱丁堡，或 LON / MNC / EDI"
        )
    sl = s.lower()
    if re.search(r"伦敦|gblon2fr|\blon\b", sl) or sl.startswith("london"):
        return "London"
    if re.search(r"曼彻斯特|gbmnc2fr|\bmnc\b", sl) or sl.startswith("manchester"):
        return "Manchester"
    # \bedi\b 可匹配独立代码 EDI；\bedinburgh\b 匹配「City: Edinburgh」等带前后缀的写法
    if (
        re.search(r"爱丁堡|gbedi2fr|\bedinburgh\b|\bedi\b", sl)
        or sl.startswith("edinburgh")
        or (re.search(r"edinburgh", sl) and "london" not in sl and "manchester" not in sl)
    ):
        return "Edinburgh"
    return s


def _collect_form_step1_error_messages(driver) -> list:
    try:
        messages = driver.execute_script(
            """
            const formId = 'formStep1';
            const texts = [];
            const root = document.getElementById(formId);
            const selectors = [
              '.ui-message-error-summary', '.ui-message-error-detail',
              '.ui-messages-error-summary', '.ui-messages-error-detail', '.erreurGlobal',
              '.ui-message-fatal-summary', '.ui-message-fatal-detail',
              '.ui-messages-fatal-summary', '.ui-messages-fatal-detail',
            ];
            const pushText = (value) => {
              const text = (value || '').trim();
              if (text && !texts.includes(text)) texts.push(text);
            };
            if (root) {
              selectors.forEach((selector) => {
                root.querySelectorAll(selector).forEach((node) => {
                  pushText(node.innerText || node.textContent || '');
                });
              });
            }
            document.querySelectorAll(
              '#globalErrorMessages li, #globalErrorMessages .ui-messages-error-summary, '
              + '#globalErrorMessages .ui-messages-error-detail'
            ).forEach((node) => {
              pushText(node.innerText || node.textContent || '');
            });
            document.querySelectorAll(
              '.ui-growl-item .ui-growl-message, .ui-growl-message, .ui-growl-item-message'
            ).forEach((node) => {
              pushText(node.innerText || node.textContent || '');
            });
            return texts;
            """
        )
        if isinstance(messages, list):
            return [str(item).strip() for item in messages if str(item).strip()]
    except Exception:
        pass
    return []


def _france_visas_step2_url_reached(url: str) -> bool:
    """第 1 步提交成功后通常会进入 step2（用户确认的成功信号）。"""
    u = (url or "").lower().split("?", 1)[0].split("#", 1)[0]
    return "/fv-fo-dde/step2.xhtml" in u or u.rstrip("/").endswith("step2.xhtml")


def _france_visas_exact_accueil_url(url: str) -> bool:
    u = (url or "").strip().lower().split("?", 1)[0].split("#", 1)[0]
    return u == "https://application-form.france-visas.gouv.fr/fv-fo-dde/accueil.xhtml"


def _france_visas_page_has_application_markers(driver) -> bool:
    try:
        page_source = driver.page_source or ""
        page_source_lower = page_source.lower()
        return bool(
            "my applications" in page_source_lower
            or "group n°" in page_source_lower
            or "group n&deg;" in page_source_lower
            or "create a new application in a new group of applications" in page_source_lower
            or re.search(r"\bfra[0-9a-z]{10,20}\b", page_source_lower) is not None
        )
    except Exception:
        return False


def _france_visas_accueil_ready(driver) -> bool:
    """判断是否已经回到 France-Visas 主页。这里只认 accueil.xhtml 精确链接。"""
    try:
        current_url = str(getattr(driver, "current_url", "") or "").lower()
        if "chrome-error://" in current_url:
            return False
        if _france_visas_exact_accueil_url(current_url):
            return True
    except Exception:
        pass
    try:
        return bool(
            driver.execute_script(
                """
                const href = String(window.location.href || '').toLowerCase();
                if (href.includes('chrome-error://')) return false;
                return href.split('?', 1)[0].split('#', 1)[0]
                  === 'https://application-form.france-visas.gouv.fr/fv-fo-dde/accueil.xhtml';
                """
            )
        )
    except Exception:
        return False


def _go_to_france_visas_accueil(driver, callback=None, max_attempts: int = 5) -> None:
    """
    France-Visas 主页偶发 ERR_HTTP2_PROTOCOL_ERROR。
    这里把返回主页改成带重试和 refresh 的容错流程，避免单次 goto 直接把整单判失败。
    """
    target_urls = [
        "https://application-form.france-visas.gouv.fr/fv-fo-dde/accueil.xhtml",
        "https://application-form.france-visas.gouv.fr/",
    ]
    last_error: Optional[Exception] = None
    if _france_visas_accueil_ready(driver):
        if callback:
            callback(81, "当前已在 France-Visas 主页，跳过重新导航")
        return
    for attempt in range(max_attempts):
        target_url = target_urls[attempt % len(target_urls)]
        try:
            if callback:
                callback(81, f"返回主页尝试 {attempt + 1}/{max_attempts}: {target_url}")
            driver.get(target_url)
        except Exception as exc:
            last_error = exc
            if callback:
                callback(81, f"返回主页失败，准备重试: {str(exc)[:120]}")

        time.sleep(2.5 + attempt * 0.5)
        if _france_visas_accueil_ready(driver):
            return

        try:
            driver.refresh()
            time.sleep(2.0)
        except Exception as exc:
            last_error = exc
        if _france_visas_accueil_ready(driver):
            return

    if _france_visas_accueil_ready(driver):
        return
    if last_error:
        raise last_error
    raise Exception("返回 France-Visas 主页失败：多次重试后仍未进入 accueil.xhtml")


def _step1_confirm_modal_button_ready(driver) -> bool:
    try:
        return bool(
            driver.execute_script(
                """
                let el = document.getElementById('formStep1:btnValiderModal');
                if (!el) el = document.querySelector('[id$="btnValiderModal"]');
                if (!el) return false;
                const style = window.getComputedStyle(el);
                if (style.visibility === 'hidden' || style.display === 'none') return false;
                const rect = el.getBoundingClientRect();
                if (rect.width < 2 || rect.height < 2) return false;
                return !el.disabled;
                """
            )
        )
    except Exception:
        return False


def _step1_visible_modal_button(driver):
    """
    用 Selenium 直接扫描 step1 弹窗里的可见按钮。
    France-Visas 这里有时弹窗已经出现，但 execute_script 级别的判断仍会偶发失败。
    """
    candidate_selectors = [
        (By.ID, "formStep1:btnValiderModal"),
        (By.CSS_SELECTOR, "[id$='btnValiderModal']"),
        (
            By.XPATH,
            "//div[contains(@class,'ui-dialog') and not(contains(@style,'display: none'))]"
            "//button[.//span[normalize-space()='Yes' or normalize-space()='No' or normalize-space()='Oui'"
            " or normalize-space()='Non' or normalize-space()='Valider' or normalize-space()='Validate']]",
        ),
        (
            By.XPATH,
            "//div[contains(@class,'ui-dialog') and not(contains(@style,'display: none'))]"
            "//button[normalize-space()='Yes' or normalize-space()='No' or normalize-space()='Oui'"
            " or normalize-space()='Non' or normalize-space()='Valider' or normalize-space()='Validate']",
        ),
    ]
    seen = set()
    for by, locator in candidate_selectors:
        try:
            elements = driver.find_elements(by, locator)
        except Exception:
            continue
        for element in elements:
            try:
                element_id = element.get_attribute("id") or ""
                element_text = (element.text or "").replace("\u00a0", " ").replace("\xa0", " ").strip()
                key = (element_id, element_text)
                if key in seen:
                    continue
                seen.add(key)
                if not element.is_displayed() or not element.is_enabled():
                    continue
                label = element_text.lower()
                if label in {"yes", "no", "oui", "non", "valider", "validate"}:
                    return element
                try:
                    span = element.find_element(By.CSS_SELECTOR, "span.ui-button-text")
                    span_text = (span.text or "").replace("\u00a0", " ").replace("\xa0", " ").strip().lower()
                    if span_text in {"yes", "no", "oui", "non", "valider", "validate"}:
                        return element
                except Exception:
                    pass
            except Exception:
                continue
    return None


def _step1_modal_button_label(button) -> str:
    if button is None:
        return ""
    try:
        text = (button.text or "").replace("\u00a0", " ").replace("\xa0", " ").strip()
        if text:
            return text
    except Exception:
        pass
    try:
        span = button.find_element(By.CSS_SELECTOR, "span.ui-button-text")
        return (span.text or "").replace("\u00a0", " ").replace("\xa0", " ").strip()
    except Exception:
        return ""


def _step1_passport_number_confirm_dialog_ready(driver) -> bool:
    """
    点击「下一步」后，France-Visas 常先弹出「Please note」护照号码确认（Yes/No），
    与后续法语的「Valider」确认框不是同一个控件。点 Yes 后可能出现 btnValiderModal，
    也可能直接导航到 fv-fo-dde/step2.xhtml（均以 step2 为成功信号）。
    """
    try:
        return bool(
            driver.execute_script(
                """
                function visible(el) {
                  if (!el) return false;
                  const s = window.getComputedStyle(el);
                  if (s.display === 'none' || s.visibility === 'hidden' || s.opacity === '0') return false;
                  const r = el.getBoundingClientRect();
                  return r.width > 2 && r.height > 2;
                }
                function bodyLooksLikePassportConfirm(txt) {
                  const t = (txt || '').toLowerCase();
                  return t.includes('travel document') || t.includes('document number')
                    || t.includes('document de voyage') || t.includes('numéro du titre')
                    || t.includes('numero du titre') || t.includes('confirmez cette saisie');
                }
                function yesTarget(root) {
                  if (!root || !visible(root)) return null;
                  const body = (root.innerText || root.textContent || '');
                  if (!bodyLooksLikePassportConfirm(body)) return null;
                  for (const span of root.querySelectorAll('span.ui-button-text')) {
                    const lab = (span.textContent || '').trim().toLowerCase();
                    if (lab !== 'yes' && lab !== 'oui') continue;
                    const btn = span.closest('button') || span.closest('a.ui-button') || span.closest('.ui-button');
                    if (btn && visible(btn)) return btn;
                  }
                  for (const b of root.querySelectorAll('button, a.ui-button, span.ui-button')) {
                    if (!visible(b)) continue;
                    const lab = (b.innerText || b.textContent || '').trim().toLowerCase();
                    if (lab === 'yes' || lab === 'oui') return b;
                  }
                  return null;
                }
                function hasYes(root) { return !!yesTarget(root); }
                const panel = document.getElementById('formStep1:idPanelModal');
                if (hasYes(panel)) return true;
                for (const dlg of document.querySelectorAll('.ui-dialog')) {
                  if (hasYes(dlg)) return true;
                }
                return false;
                """
            )
        )
    except Exception:
        return False


def _click_step1_passport_number_confirm_yes(driver) -> bool:
    try:
        return bool(
            driver.execute_script(
                """
                function visible(el) {
                  if (!el) return false;
                  const s = window.getComputedStyle(el);
                  if (s.display === 'none' || s.visibility === 'hidden' || s.opacity === '0') return false;
                  const r = el.getBoundingClientRect();
                  return r.width > 2 && r.height > 2;
                }
                function bodyLooksLikePassportConfirm(txt) {
                  const t = (txt || '').toLowerCase();
                  return t.includes('travel document') || t.includes('document number')
                    || t.includes('document de voyage') || t.includes('numéro du titre')
                    || t.includes('numero du titre') || t.includes('confirmez cette saisie');
                }
                function clickYes(root) {
                  const t = yesTarget(root);
                  if (!t) return false;
                  t.click();
                  return true;
                }
                function yesTarget(root) {
                  if (!root || !visible(root)) return null;
                  const body = (root.innerText || root.textContent || '');
                  if (!bodyLooksLikePassportConfirm(body)) return null;
                  for (const span of root.querySelectorAll('span.ui-button-text')) {
                    const lab = (span.textContent || '').trim().toLowerCase();
                    if (lab !== 'yes' && lab !== 'oui') continue;
                    const btn = span.closest('button') || span.closest('a.ui-button') || span.closest('.ui-button');
                    if (btn && visible(btn)) return btn;
                  }
                  for (const b of root.querySelectorAll('button, a.ui-button, span.ui-button')) {
                    if (!visible(b)) continue;
                    const lab = (b.innerText || b.textContent || '').trim().toLowerCase();
                    if (lab === 'yes' || lab === 'oui') return b;
                  }
                  return null;
                }
                const panel = document.getElementById('formStep1:idPanelModal');
                if (clickYes(panel)) return true;
                for (const dlg of document.querySelectorAll('.ui-dialog')) {
                  if (clickYes(dlg)) return true;
                }
                return false;
                """
            )
        )
    except Exception:
        return False


def _deposit_town_state_one_line(driver) -> str:
    """失败诊断用：单行描述递签城市控件（避免 JSON / 跨域 evaluate 偶发失败）。"""
    try:
        raw = driver.execute_script(
            """
            try {
              const lab = document.getElementById('formStep1:Visas-selected-deposit-town_label');
              const sel = document.getElementById('formStep1:Visas-selected-deposit-town_input');
              const root = document.getElementById('formStep1:Visas-selected-deposit-town');
              let labt = '';
              if (lab) labt = String(lab.innerText || lab.textContent || '').replace(/\\u00a0/g, ' ').trim();
              let val = '', ot = '';
              if (sel) {
                val = String(sel.value || '').trim();
                const i = sel.selectedIndex;
                if (i >= 0 && sel.options[i]) {
                  ot = String(sel.options[i].text || sel.options[i].innerText || '')
                    .replace(/\\s+/g, ' ').trim();
                }
              }
              const err = !!(root && root.classList && root.classList.contains('error-input'));
              return 'label=' + (labt || '(空)') + ';value=' + (val || '(空)')
                + ';option=' + (ot || '(空)') + ';errorInput=' + err;
            } catch (e) {
              return 'js_error:' + String(e && e.message ? e.message : e);
            }
            """
        )
        return str(raw) if raw else ""
    except Exception as e:
        try:
            label_text = ""
            value_text = ""
            option_text = ""
            error_input = False
            try:
                label_el = driver.find_element(By.ID, "formStep1:Visas-selected-deposit-town_label")
                label_text = (label_el.text or "").replace("\u00a0", " ").replace("\xa0", " ").strip()
            except Exception:
                pass
            try:
                select_el = driver.find_element(By.ID, "formStep1:Visas-selected-deposit-town_input")
                value_text = (select_el.get_attribute("value") or "").strip()
                current_option = select_el.find_elements(By.CSS_SELECTOR, "option:checked")
                if current_option:
                    option_text = (current_option[0].text or "").replace("\u00a0", " ").replace("\xa0", " ").strip()
            except Exception:
                pass
            try:
                root_el = driver.find_element(By.ID, "formStep1:Visas-selected-deposit-town")
                classes = root_el.get_attribute("class") or ""
                error_input = "error-input" in classes.split()
            except Exception:
                pass
            if label_text or value_text or option_text:
                return (
                    f"label={label_text or '(空)'};"
                    f"value={value_text or '(空)'};"
                    f"option={option_text or '(空)'};"
                    f"errorInput={error_input}"
                )
        except Exception:
            pass
        return f"(读取失败:{type(e).__name__})"


def _deposit_town_hidden_select_matches_excel(driver, application_city: str) -> bool:
    """
    以隐藏 select 当前选中项为准。PrimeFaces 常把展示用 span 留在 &nbsp;，但 value 已正确（你截图里即如此）。
    不能再要求 label 非空，否则会误判「未同步」而卡住。
    """
    try:
        return bool(
            driver.execute_script(
                """
                const want = (arguments[0] || '').trim().toLowerCase();
                const sel = document.getElementById('formStep1:Visas-selected-deposit-town_input');
                if (!sel || !sel.value) return false;
                const opt = sel.options[sel.selectedIndex];
                const text = ((opt && (opt.text || opt.innerText)) || '')
                  .replace(/\\u00a0/g, ' ').replace(/&nbsp;/gi, ' ').trim().toLowerCase();
                if (!text) return false;
                if (want.includes('london') || want === 'lon') return text.includes('london');
                if (want.includes('manchester') || want === 'mnc') return text.includes('manchester');
                if (want.includes('edinburgh') || want === 'edi') return text.includes('edinburgh');
                return text.includes(want) || want.includes(text);
                """,
                application_city,
            )
        )
    except Exception:
        return False


def _france_visas_step1_debug_snapshot(driver) -> Dict[str, Any]:
    """用 execute_script 抓取第 1 步关键 UI 文本，避免 Playwright find_element 长超时。"""
    out: Dict[str, Any] = {
        "form_step1_errors": _collect_form_step1_error_messages(driver),
        "confirm_modal_button_ready": _step1_confirm_modal_button_ready(driver),
    }
    try:
        snap = driver.execute_script(
            """
            const t = (id) => {
              const el = document.getElementById(id);
              if (!el) return '';
              return (el.innerText || el.textContent || '').replace(/\\s+/g, ' ').trim();
            };
            const townRoot = document.getElementById('formStep1:Visas-selected-deposit-town');
            const townSel = document.getElementById('formStep1:Visas-selected-deposit-town_input');
            let depositTownOptionText = '';
            try {
              if (townSel && townSel.selectedIndex >= 0) {
                const o = townSel.options[townSel.selectedIndex];
                depositTownOptionText = (o && (o.text || o.innerText) || '').replace(/\\s+/g, ' ').trim();
              }
            } catch (e) {}
            return {
              has_form_step1: !!document.getElementById('formStep1'),
              deposit_town_label: t('formStep1:Visas-selected-deposit-town_label') || t('formStep1:Visas-selected-deposit-town'),
              deposit_town_select_value: townSel ? (townSel.value || '').trim() : '',
              deposit_town_option_text: depositTownOptionText,
              deposit_town_error_input: !!(townRoot && townRoot.classList && townRoot.classList.contains('error-input')),
              deposit_country_label: t('formStep1:Visas-selected-deposit-country_label'),
              nationality_label: t('formStep1:visas-selected-nationality_label'),
              destination_label: t('formStep1:Visas-selected-destination_label'),
            };
            """
        )
        if isinstance(snap, dict):
            out.update(snap)
    except Exception:
        pass
    return out


def _read_visible_deposit_town_label(driver) -> str:
    """只读 combobox 展示用 label，勿读外层 div（会带上隐藏 select 里所有 option 文案导致误判为已选 London）。"""
    try:
        el = driver.find_element(By.ID, "formStep1:Visas-selected-deposit-town_label")
        t = (el.text or "").replace("\u00a0", " ").replace("\xa0", " ").strip()
        return t
    except Exception:
        return ""


def _deposit_city_label_matches(expected_city: str, label_text: str) -> bool:
    label = (label_text or "").replace("\u00a0", " ").replace("\xa0", " ").strip().lower()
    exp = (expected_city or "").strip().lower()
    if not label or not exp:
        return False
    if exp in label:
        return True
    if exp == "london":
        return "london" in label or re.search(r"\blon\b", label) is not None
    if exp == "manchester":
        return "manchester" in label or re.search(r"\bmnc\b", label) is not None
    if exp == "edinburgh":
        return "edinburgh" in label or re.search(r"\bedi\b", label) is not None
    return False


def _wait_deposit_town_persisted_ok(
    driver, application_city: str, max_rounds: int = 60, sleep_sec: float = 0.15
) -> bool:
    """成功条件：隐藏 select 选中项与 Excel 城市一致（不依赖 label span，PrimeFaces 常延迟为 &nbsp;）。"""
    for _ in range(max_rounds):
        if _deposit_town_hidden_select_matches_excel(driver, application_city):
            return True
        time.sleep(sleep_sec)
    return False


def _native_select_deposit_town_trigger_change(driver, application_city: str) -> bool:
    """
    PrimeFaces selectOneMenu 有时只更新 label 不写回隐藏 select。直接设置原生 select 并派发 change，
    以触发元素上的 onchange=\"PrimeFaces.ab(...)\"。
    """
    try:
        return bool(
            driver.execute_script(
                """
                const sel = document.getElementById('formStep1:Visas-selected-deposit-town_input');
                const raw = (arguments[0] || '').trim();
                if (!sel) return false;
                const norm = (s) => (s || '').trim().toLowerCase();
                const n = norm(raw);
                const needles = new Set([n]);
                if (n.includes('london') || n === 'lon') { needles.add('london'); needles.add('lon'); }
                if (n.includes('manchester') || n === 'mnc') { needles.add('manchester'); needles.add('mnc'); }
                if (n.includes('edinburgh') || n === 'edi') { needles.add('edinburgh'); needles.add('edi'); }
                for (let i = 0; i < sel.options.length; i++) {
                  const opt = sel.options[i];
                  if (!opt.value) continue;
                  const t = norm(opt.text);
                  let hit = false;
                  needles.forEach((nd) => {
                    if (nd && (t === nd || t.includes(nd))) hit = true;
                  });
                  if (hit) {
                    sel.selectedIndex = i;
                    sel.value = opt.value;
                    sel.dispatchEvent(new Event('input', { bubbles: true }));
                    sel.dispatchEvent(new Event('change', { bubbles: true }));
                    return true;
                  }
                }
                return false;
                """,
                application_city,
            )
        )
    except Exception:
        return False


def _playwright_select_deposit_town(automation: Any, application_city: str) -> bool:
    try:
        page = automation.get_page() if automation else None
        if page is None:
            return False
        sel = page.locator('[id="formStep1:Visas-selected-deposit-town_input"]')
        city = (application_city or "").strip()
        try:
            sel.select_option(label=city, timeout=10000)
            return True
        except Exception:
            pass
        m = city.lower()
        for lbl in ("London", "Manchester", "Edinburgh"):
            if m.startswith(lbl.lower()):
                try:
                    sel.select_option(label=lbl, timeout=10000)
                    return True
                except Exception:
                    pass
        return False
    except Exception:
        return False


def create_new_application(file_path: str, original_filename: str = None, callback: Optional[Callable[[int, str], None]] = None, output_dir: str = "", result_output: Optional[Callable[[Dict[str, Any]], None]] = None) -> Dict[str, Any]:
    """
    生成新申请
    
    Args:
        file_path: Excel文件路径
        callback: 进度回调函数
        output_dir: 输出目录（为空时使用默认目录）
    
    Returns:
        包含处理结果的字典
    """
    output_base = config.get_output_dir(output_dir or "")
    automation = FrenchVisaAutomation(callback=callback, output_dir=str(output_base))
    driver = None
    current_step = "初始化"

    def dump_debug_artifacts(step_name: str, exc: Optional[BaseException] = None) -> None:
        if not driver:
            return
        safe_step = re.sub(r"[^a-zA-Z0-9_-]+", "_", step_name).strip("_") or "unknown"
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        screenshot = output_base / f"error_{safe_step}_{ts}.png"
        html_file = output_base / f"error_{safe_step}_{ts}.html"
        meta_file = output_base / f"error_{safe_step}_{ts}.json"
        try:
            driver.save_screenshot(str(screenshot))
        except Exception:
            pass
        try:
            html = driver.page_source if hasattr(driver, "page_source") else ""
            html_file.write_text(str(html or ""), encoding="utf-8")
        except Exception:
            pass
        try:
            meta: Dict[str, Any] = {
                "step": step_name,
                "url": getattr(driver, "current_url", ""),
                "title": getattr(driver, "title", ""),
            }
            if exc is not None:
                meta["exception_type"] = type(exc).__name__
                meta["exception_message"] = str(exc)
            try:
                meta["france_visas"] = _france_visas_step1_debug_snapshot(driver)
            except Exception:
                meta["france_visas"] = {"_error": "snapshot_failed"}
            meta_file.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
        except Exception:
            pass
    
    try:
        if callback:
            callback(0, "开始生成新申请...")
        
        # 读取Excel文件
        if callback:
            callback(5, "正在读取Excel文件...")
        
        try:
            df = pd.read_excel(file_path)
            if callback:
                callback(6, "Excel文件读取完成，正在处理数据...")
        except Exception as e:
            if callback:
                callback(0, f"❌ 读取Excel文件失败: {str(e)}")
            return {
                "success": False,
                "error": f"读取Excel文件失败: {str(e)}"
            }
        
        try:
            df = df.transpose()
            if callback:
                callback(7, "数据转置完成...")
            df = df.reset_index()
            df.columns = df.iloc[0]
            df = df.iloc[1:]
            df = df.reset_index(drop=True)
            df.columns = df.columns.str.strip()
            
            if callback:
                callback(8, "数据格式处理完成...")
        except Exception as e:
            if callback:
                callback(0, f"❌ 处理Excel数据失败: {str(e)}")
            return {
                "success": False,
                "error": f"处理Excel数据失败: {str(e)}"
            }
        
        if callback:
            callback(10, "Excel文件读取成功")
        
        # 提取数据
        try:
            if callback:
                callback(11, "正在提取数据字段...")
            
            email = df['邮箱账号（Email account）'].iloc[0]
            password = df['邮箱密码（Email password）'].iloc[0]
            application_country = df['所要办理的申根国家（Schengen country to apply for）'].iloc[0]
            application_city = _normalize_france_visas_uk_deposit_city(
                df['递签城市（Visa submission city）'].iloc[0]
            )
            stay_duration = 'Short-stay (≤ 90 days)'
            destination_country = 'France'
            document_type = 'Ordinary passport'
            passport_number = df['护照号码（Number of travel document）'].iloc[0]
            
            # 解析证件发放日期（格式：日/月/年，例如：11/03/2024 = 11日3月2024年）
            issue_date_raw = df['证件发放日期（Date of issue）'].iloc[0]
            
            # 处理各种可能的输入格式
            if pd.isna(issue_date_raw):
                raise ValueError("证件发放日期为空")
            
            # 如果是pandas Timestamp或datetime对象，直接使用
            from datetime import datetime
            if isinstance(issue_date_raw, (pd.Timestamp, datetime)):
                passport_issue_date = pd.to_datetime(issue_date_raw)
                # 验证解析后的日期是否正确（显示日、月、年）
                if callback:
                    callback(12, f"✅ 日期是datetime对象: {passport_issue_date.strftime('%d/%m/%Y')} (日={passport_issue_date.day}, 月={passport_issue_date.month}, 年={passport_issue_date.year})")
            else:
                # 转换为字符串并清理
                issue_date_str = str(issue_date_raw).strip()
                # 移除可能的日期时间部分（如果Excel读取为datetime）
                if ' ' in issue_date_str:
                    issue_date_str = issue_date_str.split(' ')[0]
                
                if callback:
                    callback(12, f"原始日期字符串: {issue_date_str} (类型: {type(issue_date_raw).__name__})")
                
                try:
                    # 首先尝试 日/月/年 格式 (dd/mm/yyyy)
                    passport_issue_date = pd.to_datetime(issue_date_str, format='%d/%m/%Y', errors='raise')
                    if callback:
                        callback(12, f"✅ 日期解析成功（日/月/年）: {issue_date_str} -> {passport_issue_date.strftime('%d/%m/%Y')} (日={passport_issue_date.day}, 月={passport_issue_date.month}, 年={passport_issue_date.year})")
                except (ValueError, TypeError) as e:
                    try:
                        # 尝试 日-月-年 格式
                        passport_issue_date = pd.to_datetime(issue_date_str, format='%d-%m-%Y', errors='raise')
                        if callback:
                            callback(12, f"✅ 日期解析成功（日-月-年）: {issue_date_str} -> {passport_issue_date.strftime('%d/%m/%Y')} (日={passport_issue_date.day}, 月={passport_issue_date.month}, 年={passport_issue_date.year})")
                    except (ValueError, TypeError):
                        try:
                            # 尝试使用 dayfirst=True（优先将第一个数字作为日期）
                            passport_issue_date = pd.to_datetime(issue_date_str, dayfirst=True, errors='raise')
                            if callback:
                                callback(12, f"✅ 日期解析成功（dayfirst=True）: {issue_date_str} -> {passport_issue_date.strftime('%d/%m/%Y')} (日={passport_issue_date.day}, 月={passport_issue_date.month}, 年={passport_issue_date.year})")
                        except (ValueError, TypeError):
                            # 如果都失败，尝试手动解析
                            try:
                                # 手动解析日期字符串
                                parts = issue_date_str.replace('-', '/').replace('.', '/').split('/')
                                if len(parts) == 3:
                                    day = int(parts[0].strip())
                                    month = int(parts[1].strip())
                                    year = int(parts[2].strip())
                                    # 确保年份是4位数
                                    if year < 100:
                                        year += 2000 if year < 50 else 1900
                                    passport_issue_date = pd.Timestamp(year=year, month=month, day=day)
                                    if callback:
                                        callback(12, f"✅ 日期手动解析成功: {issue_date_str} -> {passport_issue_date.strftime('%d/%m/%Y')} (日={day}, 月={month}, 年={year})")
                                else:
                                    raise ValueError("日期格式不正确")
                            except Exception as manual_e:
                                error_msg = f"无法解析证件发放日期: {issue_date_str}，请确保格式为 日/月/年 (例如: 11/03/2024)。错误: {str(manual_e)}"
                                if callback:
                                    callback(12, f"❌ {error_msg}")
                                raise ValueError(error_msg)
            
            passport_expiry_date = (passport_issue_date + pd.DateOffset(years=10) - pd.DateOffset(days=1))
            if callback:
                callback(12, f"证件有效期: {passport_expiry_date.strftime('%d/%m/%Y')} (日/月/年)")
            travel_purpose = 'Tourism'
            
            if callback:
                callback(13, f"数据提取完成 - 邮箱: {email[:10]}..., 城市: {application_city}")
        except KeyError as e:
            if callback:
                callback(0, f"❌ Excel文件缺少必要字段: {str(e)}")
            return {
                "success": False,
                "error": f"Excel文件缺少必要字段: {str(e)}"
            }
        except Exception as e:
            if callback:
                callback(0, f"❌ 提取数据时出错: {str(e)}")
            return {
                "success": False,
                "error": f"提取数据时出错: {str(e)}"
            }
        
        if callback:
            callback(15, "数据提取完成，正在启动浏览器...")
        
        # 启动浏览器
        try:
            if callback:
                callback(16, "正在初始化浏览器...")
            browser_init_result = automation.init_browser()
            if callback:
                callback(17, f"浏览器初始化结果: {browser_init_result}")
            if not browser_init_result:
                if callback:
                    callback(0, "❌ 浏览器初始化失败")
                return {
                    "success": False,
                    "error": "浏览器初始化失败"
                }
            if callback:
                callback(18, "✅ 浏览器初始化成功")
        except Exception as e:
            import traceback
            error_detail = traceback.format_exc()
            print(f"浏览器初始化异常详情: {error_detail}")
            if callback:
                callback(0, f"❌ 浏览器初始化异常: {str(e)}")
            return {
                "success": False,
                "error": f"浏览器初始化异常: {str(e)}"
            }
        
        driver = automation.driver
        if not driver:
            if callback:
                callback(0, "❌ 浏览器驱动未创建")
            return {
                "success": False,
                "error": "浏览器驱动未创建"
            }
        
        if callback:
            callback(19, "浏览器已就绪，正在访问网站...")
        current_step = "访问 France-Visas 首页"
        driver.get("https://application-form.france-visas.gouv.fr/")
        
        wait = WebDriverWait(driver, 40)
        
        # 登录
        if callback:
            callback(25, "正在登录...")
        current_step = "填写并提交登录表单"
        email_input = wait.until(EC.presence_of_element_located((By.ID, "username")))
        email_input.send_keys(email)
        
        password_input = wait.until(EC.presence_of_element_located((By.ID, "password")))
        password_input.send_keys(password)
        
        login_form = wait.until(EC.presence_of_element_located((By.ID, "kc-form-login")))
        login_form.submit()
        
        if callback:
            callback(30, "登录表单提交完成")
        
        time.sleep(3)
        # 登录后若遇到 ERR_HTTP2_PROTOCOL_ERROR 等无法访问页面，刷新重试
        for _ in range(2):
            try:
                body_text = driver.find_element(By.TAG_NAME, "body").text
                if "无法访问此网站" in body_text or "ERR_HTTP2" in body_text or "ERR_" in body_text:
                    if callback:
                        callback(30, "检测到网络错误页面，正在刷新...")
                    driver.refresh()
                    time.sleep(3)
            except Exception:
                break
        time.sleep(1)
        
        # 创建新申请
        if callback:
            callback(35, "正在创建新申请...")
        current_step = "点击 Create a new application 按钮"
        create_new_app_button = wait.until(EC.element_to_be_clickable((By.XPATH, "//span[contains(text(), 'Create a new application in a new group of applications')]")))
        create_new_app_button.click()
        
        time.sleep(0.1)
        
        # 填写表单
        if callback:
            callback(40, "开始填写表单...")
        current_step = "填写申请表单"
        
        def open_primefaces_dropdown(label_el, panel_id: str, retries: int = 3, wait_time: float = 0.5) -> None:
            for attempt in range(retries):
                try:
                    driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", label_el)
                    time.sleep(0.2)
                    try:
                        label_el.click()
                    except Exception:
                        driver.execute_script("arguments[0].click();", label_el)
                    WebDriverWait(driver, 10).until(EC.visibility_of_element_located((By.ID, panel_id)))
                    return
                except Exception:
                    if attempt < retries - 1:
                        time.sleep(wait_time)
            raise Exception(f"无法打开下拉框: {panel_id}")
        
        try:
            driver.execute_script("window.scrollTo(0, 200);")
            time.sleep(0.3)
            
            # 选择语言
            if callback:
                callback(41, "正在选择语言...")
            language_dropdown = wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "#formHeader\\:navigationLanguage_label")))
            open_primefaces_dropdown(language_dropdown, "formHeader:navigationLanguage_panel")
            chinese_option = wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "li[data-label='中文']")))
            chinese_option.click()
            time.sleep(0.6)
            if callback:
                callback(42, "✅ 已选择中文语言")
            
            # 选择国籍（中国）
            if callback:
                callback(43, "正在选择国籍...")
            nationality_dropdown = wait.until(EC.element_to_be_clickable((By.ID, "formStep1:visas-selected-nationality_label")))
            driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", nationality_dropdown)
            time.sleep(0.2)
            open_primefaces_dropdown(nationality_dropdown, "formStep1:visas-selected-nationality_panel", retries=4, wait_time=0.6)
            chinese_option = wait.until(EC.element_to_be_clickable((By.XPATH, "//li[@data-label='Chinese']")))
            chinese_option.click()
            time.sleep(0.6)
            wait.until(lambda d: "Chinese" in d.find_element(By.ID, "formStep1:visas-selected-nationality_label").text)
            if callback:
                callback(44, "✅ 已选择中国国籍")
            
            # 选择提交国家
            if callback:
                callback(45, "正在选择提交国家...")
            deposit_country_dropdown = wait.until(EC.element_to_be_clickable((By.ID, "formStep1:Visas-selected-deposit-country_label")))
            driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", deposit_country_dropdown)
            time.sleep(0.2)
            open_primefaces_dropdown(deposit_country_dropdown, "formStep1:Visas-selected-deposit-country_panel")
            deposit_country_option = wait.until(EC.element_to_be_clickable((By.XPATH, "//li[@data-label='United Kingdom']")))
            deposit_country_option.click()
            time.sleep(0.3)
            wait.until(lambda d: "United Kingdom" in d.find_element(By.ID, "formStep1:Visas-selected-deposit-country_label").text)
            if callback:
                callback(46, "✅ 已选择英国作为提交国家")
            
            # 选择停留时间
            if callback:
                callback(47, "正在选择停留时间...")
            driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", 
                                 driver.find_element(By.ID, "formStep1:Visas-selected-stayDuration_label"))
            time.sleep(0.2)
            duration_dropdown = wait.until(EC.element_to_be_clickable((By.ID, "formStep1:Visas-selected-stayDuration_label")))
            duration_dropdown.click()
            duration_option = wait.until(EC.element_to_be_clickable((By.XPATH, f"//li[@data-label='{stay_duration}']")))
            duration_option.click()
            time.sleep(0.3)
            if callback:
                callback(48, "✅ 已选择停留时间")
            
            # 选择目的地国家
            if callback:
                callback(49, "正在选择目的地国家...")
            destination_dropdown = wait.until(EC.element_to_be_clickable((By.ID, "formStep1:Visas-selected-destination_label")))
            current_destination = (destination_dropdown.text or "").strip()
            if "France" not in current_destination:
                driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", destination_dropdown)
                time.sleep(0.3)
                open_primefaces_dropdown(destination_dropdown, "formStep1:Visas-selected-destination_panel", retries=4, wait_time=0.8)
                france_option = None
                destination_option_locators = [
                    (By.CSS_SELECTOR, "li[data-label='France']"),
                    (By.XPATH, "//li[@data-label='France']"),
                    (By.XPATH, "//li[contains(@data-label,'France')]"),
                    (By.XPATH, "//li[contains(normalize-space(.), 'France')]"),
                    (By.XPATH, "//li[contains(normalize-space(.), '法国')]"),
                ]
                for by, locator in destination_option_locators:
                    try:
                        france_option = WebDriverWait(driver, 8).until(EC.element_to_be_clickable((by, locator)))
                        break
                    except Exception:
                        continue
                if not france_option:
                    raise Exception("未找到目的地国家选项 France/法国")
                france_option.click()
                time.sleep(0.6)
                wait.until(lambda d: "France" in d.find_element(By.ID, "formStep1:Visas-selected-destination_label").text)
            else:
                if callback:
                    callback(50, "目的地国家已是 France，跳过重新选择")
            if callback:
                callback(50, "✅ 已选择法国作为目的地")
            
            # 选择申请城市（必须点 label + 限定 panel 内选项；读验证文案时禁止用外层 div，否则会误含 option 文本）
            if callback:
                callback(51, f"正在选择申请城市: {application_city}...")
            deposit_town_panel_xpath = "//*[@id='formStep1:Visas-selected-deposit-town_panel']"
            city_option_locators = [
                (By.XPATH, f"{deposit_town_panel_xpath}//li[@data-label='{application_city}']"),
                (By.XPATH, f"{deposit_town_panel_xpath}//li[contains(@data-label,'{application_city}')]"),
                (By.XPATH, f"{deposit_town_panel_xpath}//li[contains(normalize-space(.), '{application_city}')]"),
            ]
            if application_city.lower().startswith("london"):
                city_option_locators.extend([
                    (By.XPATH, f"{deposit_town_panel_xpath}//li[contains(@data-label,'LON')]"),
                    (By.XPATH, f"{deposit_town_panel_xpath}//li[contains(normalize-space(.), 'London')]"),
                ])
            elif application_city.lower().startswith("manchester"):
                city_option_locators.extend([
                    (By.XPATH, f"{deposit_town_panel_xpath}//li[contains(@data-label,'MNC')]"),
                    (By.XPATH, f"{deposit_town_panel_xpath}//li[contains(normalize-space(.), 'Manchester')]"),
                ])
            elif application_city.lower().startswith("edinburgh"):
                city_option_locators.extend([
                    (By.XPATH, f"{deposit_town_panel_xpath}//li[contains(@data-label,'EDI')]"),
                    (By.XPATH, f"{deposit_town_panel_xpath}//li[contains(normalize-space(.), 'Edinburgh')]"),
                ])

            city_option = None
            for open_try in range(3):
                city_menu_label = wait.until(
                    EC.element_to_be_clickable((By.ID, "formStep1:Visas-selected-deposit-town_label"))
                )
                driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", city_menu_label)
                time.sleep(0.2)
                open_primefaces_dropdown(
                    city_menu_label, "formStep1:Visas-selected-deposit-town_panel", retries=4, wait_time=0.55
                )
                try:
                    WebDriverWait(driver, 4).until(
                        lambda d: len(
                            d.find_elements(
                                By.XPATH,
                                f"{deposit_town_panel_xpath}//li[contains(@class,'ui-selectonemenu-item')]",
                            )
                        )
                        > 0
                    )
                except Exception:
                    pass
                for by, locator in city_option_locators:
                    try:
                        city_option = WebDriverWait(driver, 5).until(EC.element_to_be_clickable((by, locator)))
                        break
                    except Exception:
                        continue
                if city_option:
                    break
                if callback:
                    callback(51, f"申请城市选项未加载，重试打开下拉 ({open_try + 1}/3)")
                try:
                    driver.find_element(By.TAG_NAME, "body").click()
                except Exception:
                    pass
                time.sleep(0.35)

            if not city_option:
                if callback:
                    callback(51, "申请城市下拉仍未加载，刷新页面后重试一次")
                driver.refresh()
                wait.until(EC.presence_of_element_located((By.ID, "formStep1:Visas-selected-deposit-town_label")))
                time.sleep(0.9)
                city_menu_label = wait.until(
                    EC.element_to_be_clickable((By.ID, "formStep1:Visas-selected-deposit-town_label"))
                )
                driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", city_menu_label)
                open_primefaces_dropdown(
                    city_menu_label, "formStep1:Visas-selected-deposit-town_panel", retries=4, wait_time=0.6
                )
                time.sleep(0.4)
                for by, locator in city_option_locators:
                    try:
                        city_option = WebDriverWait(driver, 6).until(EC.element_to_be_clickable((by, locator)))
                        break
                    except Exception:
                        continue
            if not city_option:
                raise Exception(f"未找到申请城市选项: {application_city}")
            city_option.click()
            time.sleep(0.25)
            if not _wait_deposit_town_persisted_ok(driver, application_city, max_rounds=55):
                if callback:
                    callback(51, "递签城市 UI 未完全同步，尝试原生 select + change 触发 PrimeFaces…")
                if _native_select_deposit_town_trigger_change(driver, application_city):
                    time.sleep(1.2)
                if not _wait_deposit_town_persisted_ok(driver, application_city, max_rounds=45, sleep_sec=0.2):
                    if callback:
                        callback(51, "尝试 Playwright select_option 写入递签城市…")
                    _playwright_select_deposit_town(automation, application_city)
                    time.sleep(1.0)
                if not _wait_deposit_town_persisted_ok(driver, application_city, max_rounds=55):
                    city_label_text = _read_visible_deposit_town_label(driver)
                    if not _deposit_city_label_matches(application_city, city_label_text):
                        raise Exception(
                            f"申请城市选择未生效，可见 label: {city_label_text or '空'}（注意：PrimeFaces 可能仍显示 &nbsp;，"
                            f"以隐藏下拉为准；期望 {application_city}）。"
                        )
                    raise Exception(
                        f"递签城市隐藏下拉仍未选到「{application_city}」（已尝试点击、原生 change、Playwright）。"
                        "若页面上看起来像已选但 label 仍是空白，多为控件未提交；请刷新页面重试或检查网络。"
                    )
            if callback:
                callback(52, f"✅ 已选择申请城市: {application_city}")
            
            # 选择证件类型
            if callback:
                callback(53, "正在选择证件类型...")
            driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", 
                                 driver.find_element(By.ID, "formStep1:Visas-dde-travel-document_label"))
            time.sleep(0.2)
            travel_doc_dropdown = wait.until(EC.element_to_be_clickable((By.ID, "formStep1:Visas-dde-travel-document_label")))
            travel_doc_dropdown.click()
            doc_type_option = wait.until(EC.element_to_be_clickable((By.XPATH, f"//li[@data-label='{document_type}']")))
            doc_type_option.click()
            time.sleep(0.2)
            if callback:
                callback(54, "✅ 已选择证件类型")
            
            # 填写护照信息
            if callback:
                callback(55, "正在填写护照信息...")
            driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", 
                                 driver.find_element(By.ID, "formStep1:Visas-dde-travel-document-number"))
            time.sleep(0.2)
            travel_doc_number = wait.until(EC.element_to_be_clickable((By.ID, "formStep1:Visas-dde-travel-document-number")))
            travel_doc_number.send_keys(passport_number.upper())
            time.sleep(0.2)
            if callback:
                callback(56, "✅ 已填写护照号码")
            
            release_date_input = wait.until(EC.element_to_be_clickable((By.ID, "formStep1:Visas-dde-release_date_real_input")))
            release_date_input.click()
            release_date_input.send_keys(passport_issue_date.strftime('%d/%m/%Y'))
            time.sleep(0.2)
            if callback:
                callback(57, "✅ 已填写护照签发日期")
            
            expiry_date_input = wait.until(EC.element_to_be_clickable((By.ID, "formStep1:Visas-dde-expiration_date_input")))
            expiry_date_input.click()
            expiry_date_input.send_keys(passport_expiry_date.strftime('%d/%m/%Y'))
            time.sleep(0.2)
            if callback:
                callback(58, "✅ 已填写护照到期日期")
            
            body = wait.until(EC.element_to_be_clickable((By.TAG_NAME, "body")))
            body.click()
            time.sleep(0.2)
            
            # 选择旅行目的
            if callback:
                callback(59, "正在选择旅行目的...")
            driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", 
                                 driver.find_element(By.ID, "formStep1:Visas-selected-purposeCategory_label"))
            time.sleep(0.2)
            purpose_dropdown = wait.until(EC.element_to_be_clickable((By.ID, "formStep1:Visas-selected-purposeCategory_label")))
            purpose_dropdown.click()
            purpose_option = wait.until(EC.element_to_be_clickable((By.XPATH, f"//li[@data-label='{travel_purpose}']")))
            purpose_option.click()
            time.sleep(0.2)
            time.sleep(2)
            if callback:
                callback(60, "✅ 已选择旅行目的类别")
            
            driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", 
                                 driver.find_element(By.ID, "formStep1:Visas-selected-purpose_label"))
            time.sleep(0.2)
            specific_purpose_dropdown = wait.until(EC.element_to_be_clickable((By.ID, "formStep1:Visas-selected-purpose_label")))
            specific_purpose_dropdown.click()
            time.sleep(0.2)
            time.sleep(1)
            
            tourism_option = wait.until(EC.element_to_be_clickable((By.XPATH, "//li[@data-label='Tourism / Private visit']")))
            tourism_option.click()
            time.sleep(0.2)
            if callback:
                callback(61, "✅ 已选择具体旅行目的")
            
            body = wait.until(EC.element_to_be_clickable((By.TAG_NAME, "body")))
            body.click()
            time.sleep(0.2)
            
            if callback:
                callback(65, "表单填写完成，正在提交...")
            
            # 提交表单
            driver.execute_script("try{var b=document&&(document.body||document.documentElement);if(b)window.scrollTo(0,(b.scrollHeight||0))}catch(e){}")
            time.sleep(0.2)
            if callback:
                callback(66, "正在点击验证按钮...")
            verify_button = wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "button[id$='btnVerifier']")))
            verify_button.click()
            time.sleep(0.2)
            if callback:
                callback(67, "✅ 已点击验证按钮")
            # 验证会触发 PrimeFaces AJAX；立刻点「下一步」可能无确认框或校验未落盘
            time.sleep(2.2)
            try:
                driver.execute_script(
                    """
                    const end = Date.now() + 8000;
                    while (Date.now() < end) {
                      const ov = document.querySelector('.ui-widget-overlay');
                      if (!ov) break;
                      const st = window.getComputedStyle(ov);
                      if (st.display === 'none' || st.visibility === 'hidden' || st.opacity === '0') break;
                    }
                    """
                )
            except Exception:
                pass
            
            if callback:
                callback(68, "正在点击下一步按钮...")
            next_button = wait.until(EC.element_to_be_clickable((By.ID, "formStep1:btnSuivant")))
            next_button.click()
            time.sleep(0.2)
            if callback:
                callback(69, "✅ 已点击下一步按钮")
            
            if callback:
                callback(70, "正在确认提交（等待确认对话框）...")
            # 校验失败时常无确认框，原先用 WebDriverWait + Playwright 默认 60s 会表现为 Timeout 60000ms exceeded
            yes_button = None
            step1_after_next: Optional[str] = None
            poll_deadline = time.time() + 45.0
            while time.time() < poll_deadline:
                if _france_visas_step2_url_reached(getattr(driver, "current_url", "") or ""):
                    step1_after_next = "step2"
                    if callback:
                        callback(70, "✅ 已进入第 2 步 (step2.xhtml)，第 1 步提交成功")
                    break
                errs = _collect_form_step1_error_messages(driver)
                modal_button = _step1_visible_modal_button(driver)
                modal_label = _step1_modal_button_label(modal_button).strip().lower()
                if errs:
                    _step1_exc = Exception(
                        "France-Visas 第 1 步校验未通过（点击下一步后未进入确认框）。页面提示: "
                        + "; ".join(errs)
                    )
                    dump_debug_artifacts("step1_validation_errors", _step1_exc)
                    raise _step1_exc
                # 英文界面：先出现护照号码「Please note」Yes/No，点 Yes 后才会出现法语的 Valider 按钮
                if modal_button and modal_label in {"yes", "oui"}:
                    if callback:
                        callback(70, "检测到护照号码确认弹窗，正在点击 Yes...")
                    try:
                        modal_button.click()
                    except Exception:
                        try:
                            driver.execute_script("arguments[0].click();", modal_button)
                        except Exception:
                            pass
                    time.sleep(0.6)
                    continue
                if modal_button:
                    yes_button = modal_button
                    step1_after_next = "valider"
                    break
                if _step1_passport_number_confirm_dialog_ready(driver) and not _step1_confirm_modal_button_ready(
                    driver
                ):
                    if callback:
                        callback(70, "检测到护照号码确认弹窗，正在点击 Yes...")
                    if _click_step1_passport_number_confirm_yes(driver):
                        time.sleep(0.6)
                    else:
                        time.sleep(0.35)
                    continue
                if _step1_confirm_modal_button_ready(driver):
                    yes_button = None
                    try:
                        yes_button = driver.find_element(By.ID, "formStep1:btnValiderModal")
                    except Exception:
                        try:
                            yes_button = driver.find_element(By.CSS_SELECTOR, "[id$='btnValiderModal']")
                        except Exception:
                            yes_button = None
                    if yes_button:
                        step1_after_next = "valider"
                        break
                time.sleep(0.35)
            if step1_after_next != "step2" and not yes_button:
                errs = _collect_form_step1_error_messages(driver)
                _snap = _france_visas_step1_debug_snapshot(driver)
                city_hint = str(_snap.get("deposit_town_label") or "").strip()
                town_line = _deposit_town_state_one_line(driver)
                err_part = f" 页面提示: {'; '.join(errs)}。" if errs else ""
                snap_part = ""
                if _snap.get("deposit_town_select_value") or _snap.get("deposit_town_option_text"):
                    snap_part = (
                        f" [快照 select={_snap.get('deposit_town_select_value', '')!s} "
                        f"option={_snap.get('deposit_town_option_text', '')!s} "
                        f"errInput={_snap.get('deposit_town_error_input')!s}]"
                    )
                _modal_exc = Exception(
                    "点击「下一步」后未出现确认对话框，页面可能仍停在第 1 步（常见原因：递签城市、护照日期、旅行目的等未通过校验）。"
                    + err_part
                    + f" 递签城市(label): {city_hint or '（空）'}。"
                    + (f" 递签城市(控件): {town_line}" if town_line else "")
                    + snap_part
                )
                dump_debug_artifacts("step1_next_no_confirm_modal", _modal_exc)
                raise _modal_exc
            if step1_after_next == "step2":
                if callback:
                    callback(71, "✅ 已在 step2，跳过法语 Valider 确认框")
            else:
                try:
                    yes_button.click()
                except Exception:
                    driver.execute_script("arguments[0].click();", yes_button)
                time.sleep(0.2)
                if callback:
                    callback(71, "✅ 已点击 Valider 确认提交")
                try:
                    WebDriverWait(driver, 25).until(
                        lambda d: _france_visas_step2_url_reached(d.current_url)
                    )
                except Exception:
                    pass
            
            # 等待页面跳转或加载完成（等待更长时间确保步骤完成）
            if callback:
                callback(72, "等待表单提交完成...")
            time.sleep(3)
            
            # 检查是否已经跳转到主页或其他页面（表单提交成功通常会跳转）
            try:
                # 等待URL变化或等待特定元素消失/出现
                current_url = driver.current_url
                if callback:
                    callback(73, f"检查页面状态，当前URL: {current_url[:50]}...")
                
                # 尝试等待页面跳转（如果还在表单页面，等待跳转）
                if "formStep1" in current_url or "formStep" in current_url:
                    # 等待跳转到主页（最多等待10秒）
                    if callback:
                        callback(74, "等待页面自动跳转...")
                    wait_redirect = WebDriverWait(driver, 10)
                    try:
                        wait_redirect.until(lambda d: "accueil" in d.current_url.lower() or "formStep" not in d.current_url)
                        if callback:
                            callback(75, "✅ 页面已自动跳转")
                    except:
                        # 如果10秒内没有自动跳转，说明可能需要手动跳转
                        if callback:
                            callback(75, "未检测到自动跳转，准备手动跳转...")
                else:
                    if callback:
                        callback(75, "✅ 页面已不在表单页面")
            except Exception as e:
                if callback:
                    callback(75, f"检查页面跳转: {str(e)[:50]}...")
            
            time.sleep(2)  # 额外等待确保页面完全加载
            
            if callback:
                callback(80, "正在返回到主页...")
            
            # 返回到主页。France-Visas 偶发 HTTP/2 协议错误，改为带重试的容错导航。
            _go_to_france_visas_accueil(driver, callback=callback, max_attempts=6)
            if callback:
                callback(82, "✅ 已返回到主页，等待页面加载...")
            
            # 等待页面完全加载（增加等待时间）
            time.sleep(5)

            marker_deadline = time.time() + 12
            while time.time() < marker_deadline:
                if _france_visas_page_has_application_markers(driver):
                    break
                time.sleep(0.5)
            
            # 等待表格加载完成
            try:
                wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "table, .dataTable, [class*='table']")))
                if callback:
                    callback(83, "✅ 表格已加载")
            except:
                if callback:
                    callback(83, "⚠️ 未检测到表格，继续尝试...")
            
            if callback:
                callback(85, "正在查找申请参考号...")
            
            # 获取申请参考号（增加重试逻辑和多种方法）
            application_ref = None
            max_retries = 3
            retry_delay = 3
            
            for attempt in range(max_retries):
                try:
                    if callback:
                        callback(85 + attempt * 2, f"尝试获取申请参考号 (方法 {attempt + 1}/{max_retries})...")
                    
                    # 方法1: 使用完整类名选择器（更灵活，不要求顺序）
                    try:
                        # 尝试多种选择器变体
                        selectors = [
                            "td.cell.value.showIfTabletteOrDesktop.forceWidth15",
                            "td[class*='cell'][class*='value'][class*='showIfTabletteOrDesktop'][class*='forceWidth15']",
                            "td.forceWidth15",
                            "td.cell.value.forceWidth15"
                        ]
                        
                        for selector in selectors:
                            try:
                                elements = driver.find_elements(By.CSS_SELECTOR, selector)
                                for elem in elements:
                                    text = elem.text.strip()
                                    # 清理文本（移除换行符、多余空格）
                                    text = ' '.join(text.split())
                                    # 使用提取函数获取参考号
                                    extracted_ref = extract_reference_number(text)
                                    if extracted_ref:
                                        application_ref = extracted_ref
                                        if callback:
                                            callback(87, f"✅ 找到申请参考号: {application_ref}")
                                        break
                                if application_ref:
                                    break
                            except:
                                continue
                        
                        if application_ref:
                            break
                    except Exception as e:
                        if callback:
                            callback(87, f"方法1失败: {str(e)[:50]}...")
                    
                    # 方法2: 查找所有包含参考号特征的td元素
                    if not application_ref:
                        try:
                            # 查找所有td元素，检查文本内容
                            all_tds = driver.find_elements(By.TAG_NAME, "td")
                            for td in all_tds:
                                text = td.text.strip()
                                text = ' '.join(text.split())  # 清理空白字符
                                # 使用提取函数获取参考号
                                extracted_ref = extract_reference_number(text)
                                if extracted_ref:
                                    application_ref = extracted_ref
                                    if callback:
                                        callback(87, f"✅ 找到申请参考号: {application_ref}")
                                    break
                        except Exception as e:
                            if callback:
                                callback(87, f"方法2失败: {str(e)[:50]}...")
                    
                    # 方法3: 查找表格第一行第一列或包含"参考号"的列
                    if not application_ref:
                        try:
                            # 查找表格
                            tables = driver.find_elements(By.CSS_SELECTOR, "table, .dataTable")
                            for table in tables:
                                rows = table.find_elements(By.TAG_NAME, "tr")
                                for row in rows:
                                    cells = row.find_elements(By.TAG_NAME, "td")
                                    for cell in cells:
                                        text = cell.text.strip()
                                        text = ' '.join(text.split())
                                        # 使用提取函数获取参考号
                                        extracted_ref = extract_reference_number(text)
                                        if extracted_ref:
                                            application_ref = extracted_ref
                                            if callback:
                                                callback(87, f"✅ 找到申请参考号: {application_ref}")
                                            break
                                    if application_ref:
                                        break
                                if application_ref:
                                    break
                        except Exception as e:
                            if callback:
                                callback(87, f"方法3失败: {str(e)[:50]}...")
                    
                    if application_ref:
                        break
                    
                    # 如果这次尝试失败，等待后重试
                    if attempt < max_retries - 1:
                        if callback:
                            callback(87, f"未找到，等待 {retry_delay} 秒后重试...")
                        time.sleep(retry_delay)
                        
                except Exception as e:
                    if callback:
                        callback(87, f"尝试 {attempt + 1} 出错: {str(e)[:50]}...")
                    if attempt < max_retries - 1:
                        time.sleep(retry_delay)
            
            if not application_ref:
                # 最后一次尝试：获取页面源码用于调试
                try:
                    page_source_snippet = driver.page_source[:2000] if len(driver.page_source) > 2000 else driver.page_source
                    if callback:
                        callback(90, f"⚠️ 页面源码片段: {page_source_snippet[-500:]}")
                except:
                    pass
                raise Exception("无法获取申请参考号：所有方法都失败，请检查页面是否已正确加载")
            
            if callback:
                callback(88, f"✅ 已获取申请参考号: {application_ref}")
            
            # 创建结果DataFrame
            if callback:
                callback(89, "正在创建结果数据...")
            result_df = pd.DataFrame({
                "邮箱": [email],
                "密码": [password],
                "申请参考号": [application_ref],
                "申请城市": [application_city],
                "姓氏": [df['姓氏（Family name）'].iloc[0]],
                "名字": [df['名字（First name）'].iloc[0]],
                "出生日期": [pd.to_datetime(df['出生日期（Date of birth）'].iloc[0], dayfirst=True, errors="coerce")],
                "当前国籍": ["Chinese"],
                "护照类型": ["Ordinary passport"],
                "护照编号": [passport_number],
                "护照签发日期": [passport_issue_date.strftime('%Y-%m-%d')],
                "护照到期时间": [passport_expiry_date.strftime('%Y-%m-%d')],
                "手机号码": [df['你的电话（Your phone number with +44）'].iloc[0]],
                "是否办过申根签": [df['是否办过申根签（五年内）'].iloc[0]]
            })
            
            # 保存文件
            if callback:
                callback(90, "正在准备保存文件...")
            # 如果没有提供原始文件名，使用文件路径的基础名称；去掉扩展名用于输出文件名
            if not original_filename:
                original_filename = os.path.basename(file_path)
            original_stem = os.path.splitext(original_filename)[0]
            excel_dir = os.path.dirname(file_path)
            folder_name = os.path.join(excel_dir, f"{original_stem}_TLS")
            os.makedirs(folder_name, exist_ok=True)
            if callback:
                callback(91, "✅ 已创建输出文件夹")
            
            # 创建JSON结构
            if callback:
                callback(92, "正在创建JSON数据...")
            dob_raw = df['出生日期（Date of birth）'].iloc[0]
            try:
                dob_parsed = pd.to_datetime(dob_raw, dayfirst=True, errors="coerce")
            except Exception:
                dob_parsed = pd.to_datetime(dob_raw, errors="coerce")
            date_of_birth_iso = dob_parsed.strftime('%Y-%m-%d') if not pd.isnull(dob_parsed) else ""

            # 预计出行时间计算规则：
            # 出发时间 = 当天日期晚后 + 21 天
            # 到达时间 = 与出发时间相同
            # 返回时间 = 在出发时间基础上 + 7 天
            today_date = datetime.now().date()
            departure_date = today_date + timedelta(days=21)
            arrival_date = departure_date
            return_date = departure_date + timedelta(days=7)
            departure_date_iso = departure_date.strftime('%Y-%m-%d')
            arrival_date_iso = arrival_date.strftime('%Y-%m-%d')
            return_date_iso = return_date.strftime('%Y-%m-%d')

            visa_json = [{
                "id": 1,
                "personalInfo": {
                    "familyName": df['姓氏（Family name）'].iloc[0],
                    "firstName": df['名字（First name）'].iloc[0],
                    "dateOfBirth": date_of_birth_iso,
                    "passportNumber": passport_number,
                    "passportIssueDate": passport_issue_date.strftime('%Y-%m-%d'),
                    "passportExpiryDate": passport_expiry_date.strftime('%Y-%m-%d'),
                    "mobileNumber": str(df['你的电话（Your phone number with +44）'].iloc[0]).replace(' ', '').lstrip('44').lstrip('+'),
                    "franceVisasRef": application_ref,
                    "nationality": "China",
                    "passportType": "Ordinary passport"
                },
                "travelInfo": {
                    "visaType": "Short stay (<90 days) - Tourism",
                    "reason": "Tourism / Private visit",
                    "departureDate": departure_date_iso,
                    "arrivalDate": arrival_date_iso,
                    "returnDate": return_date_iso,
                    "frenchOverseas": False
                },
                "visaHistory": {
                    "previousFingerprints": False
                }
            }]
            
            # 保存JSON文件（先保存到临时目录）
            if callback:
                callback(93, "正在保存JSON文件...")
            family_name_raw = str(df['姓氏（Family name）'].iloc[0]).strip()
            first_name_raw = str(df['名字（First name）'].iloc[0]).strip()
            applicant_name = f"{family_name_raw}_{first_name_raw}".strip("_")
            applicant_name_safe = re.sub(r"[^0-9A-Za-z_\-]+", "_", applicant_name).strip("_")
            if not applicant_name_safe:
                applicant_name_safe = re.sub(r"[^0-9A-Za-z_\-]+", "_", original_stem).strip("_") or "applicant"
            generated_ts = datetime.now().strftime("%Y%m%d_%H%M%S")
            tls_json_filename = f"tls_apply_{applicant_name_safe}_{generated_ts}.json"
            json_filename_temp = os.path.join(folder_name, tls_json_filename)
            with open(json_filename_temp, 'w', encoding='utf-8') as f_json:
                json.dump(visa_json, f_json, ensure_ascii=False, indent=2)
            if callback:
                callback(94, "✅ JSON文件已保存到临时目录")
            
            # 复制文件到输出目录以便下载
            if callback:
                callback(97, "正在复制文件到输出目录...")
            import shutil
            json_filename = os.path.basename(json_filename_temp)
            json_path = output_base / json_filename
            if str(json_filename_temp) != str(json_path):
                shutil.copy2(json_filename_temp, json_path)
            if callback:
                callback(98, "✅ JSON文件已复制到输出目录")
            
            if callback:
                callback(100, f"✅ 新申请创建成功！申请参考号: {application_ref}")
            result = {
                "success": True,
                "application_ref": application_ref,
                "json_file": json_filename,
                "json_path": str(json_path),
                "message": f"新申请创建成功，申请参考号: {application_ref}"
            }
            # 在 return 之前先输出结果，避免 finally 中可能的阻塞导致 API 无法收到 JSON
            if result_output:
                result_output(result)
            # 解除 driver/automation 引用，避免 return 时 GC 清理 Playwright 导致阻塞
            try:
                if automation and hasattr(automation, "driver"):
                    automation.driver = None
                driver = None
            except Exception:
                pass
            return result
            
        except Exception as e:
            dump_debug_artifacts(current_step, e)
            if callback:
                callback(0, f"❌ 填写表单时出错（步骤: {current_step}）: {str(e)}")
            return {
                "success": False,
                "error": f"{current_step}: {str(e)}"
            }
        
    except Exception as e:
        dump_debug_artifacts(current_step, e)
        if callback:
            callback(0, f"❌ 处理时发生错误（步骤: {current_step}）: {str(e)}")
        return {
            "success": False,
            "error": f"{current_step}: {str(e)}"
        }
    finally:
        # 完全不调用 close_browser：browser.close() 也会阻塞，导致进程无法退出。
        # 直接返回让 CLI 输出 JSON 并退出，进程退出时 OS 会回收子进程。
        pass
