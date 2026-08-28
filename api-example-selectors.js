(() => {
  const ENHANCER_VERSION = 'menu-v15';

  const splitRequestLabel = (label) => {
    const parts = label.split(/\s+·\s+/);
    return {
      primary: parts[0] || 'cURL',
      secondary: parts.slice(1).join(' · '),
    };
  };

  const splitResponseLabel = (label) => {
    const match = label.match(/^(\d{3}|default)\s*(.*)$/i);
    return match
      ? { primary: match[1], secondary: match[2] || 'Example' }
      : { primary: label, secondary: 'Example' };
  };

  const unique = (values) => [...new Set(values.filter(Boolean))];

  const createDropdown = (label, values, selected, onChange) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'api-example-menu-wrap';

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'api-example-menu-trigger';
    trigger.setAttribute('aria-label', label);
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');

    const valueText = document.createElement('span');
    valueText.className = 'api-example-menu-value';
    trigger.appendChild(valueText);

    const menu = document.createElement('div');
    menu.className = 'api-example-menu';
    menu.setAttribute('role', 'listbox');
    menu.hidden = true;

    let currentValue = selected;

    const close = () => {
      menu.hidden = true;
      trigger.setAttribute('aria-expanded', 'false');
      wrapper.classList.remove('is-open');
    };

    const setOptions = (nextValues) => {
      const sameOptions = nextValues.length === menu.children.length
        && nextValues.every((value, index) => menu.children[index]?.dataset.value === value);
      currentValue = nextValues.includes(currentValue) ? currentValue : nextValues[0] || '';
      if (sameOptions) {
        valueText.textContent = currentValue;
        for (const item of menu.children) {
          item.dataset.selected = item.dataset.value === currentValue ? 'true' : 'false';
        }
        return;
      }
      menu.replaceChildren();
      for (const value of nextValues) {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'api-example-menu-item';
        item.setAttribute('role', 'option');
        item.dataset.value = value;
        item.textContent = value;
        item.addEventListener('click', (event) => {
          event.stopPropagation();
          currentValue = value;
          valueText.textContent = value;
          onChange(value);
          close();
          setOptions(nextValues);
        });
        menu.appendChild(item);
      }
      valueText.textContent = currentValue;
      for (const item of menu.children) {
        item.dataset.selected = item.dataset.value === currentValue ? 'true' : 'false';
      }
    };

    trigger.addEventListener('click', (event) => {
      event.stopPropagation();
      const open = menu.hidden;
      document.querySelectorAll('.api-example-menu:not([hidden])').forEach((other) => {
        other.hidden = true;
        other.previousElementSibling?.setAttribute('aria-expanded', 'false');
        other.parentElement?.classList.remove('is-open');
      });
      menu.hidden = !open;
      trigger.setAttribute('aria-expanded', String(open));
      wrapper.classList.toggle('is-open', open);
    });

    wrapper.append(trigger, menu);
    setOptions(values);
    return {
      wrapper,
      setOptions(nextValues) {
        currentValue = nextValues.includes(currentValue) ? currentValue : nextValues[0] || '';
        setOptions(nextValues);
      },
      setValue(value) {
        currentValue = value;
        valueText.textContent = value;
        for (const item of menu.children) {
          item.dataset.selected = item.dataset.value === value ? 'true' : 'false';
        }
      },
    };
  };

  const cleanupCodeGroup = (group) => {
    const state = group.__apiSelectorState;
    state?.syncTimers?.forEach((timer) => clearTimeout(timer));
    state?.syncTimer && clearTimeout(state.syncTimer);
    state?.tabs?.forEach((tab) => tab.removeEventListener('click', state.onTabClick));
    state?.originalTabs?.classList.remove('api-example-original-tabs');
    if (state?.originalTabs) {
      if (state.originalAriaHidden === null) state.originalTabs.removeAttribute('aria-hidden');
      else state.originalTabs.setAttribute('aria-hidden', state.originalAriaHidden);
      if (state.originalStyle === null) state.originalTabs.removeAttribute('style');
      else state.originalTabs.setAttribute('style', state.originalStyle);
    }
    group.querySelectorAll('.api-example-selector-bar').forEach((element) => element.remove());
    delete group.__apiSelectorState;
    delete group.dataset.apiSelectorReady;
  };

  const enhanceCodeGroup = (group, kind) => {
    const header = group.querySelector('[data-component-part="code-group-tab-bar"]');
    const tabList = header?.querySelector('[role="tablist"]');
    const tabs = tabList ? [...tabList.querySelectorAll('[role="tab"]')] : [];
    if (!header || tabs.length === 0) return;

    const existing = group.__apiSelectorState;
    if (existing
      && existing.tabList === tabList
      && existing.tabs.length === tabs.length
      && existing.tabs.every((tab, index) => tab === tabs[index])) {
      existing.syncFromActiveTab();
      return;
    }
    if (existing) {
      cleanupCodeGroup(group);
    } else {
      group.querySelectorAll('.api-example-selector-bar').forEach((element) => element.remove());
      group.querySelectorAll('.api-example-original-tabs').forEach((element) => {
        element.classList.remove('api-example-original-tabs');
        element.removeAttribute('aria-hidden');
        element.style.removeProperty('display');
      });
      delete group.dataset.apiSelectorReady;
    }

    const parseLabel = kind === 'request' ? splitRequestLabel : splitResponseLabel;
    const entries = tabs.map((tab) => ({
      tab,
      label: tab.textContent.trim(),
      ...parseLabel(tab.textContent.trim()),
    }));
    const activeEntry = entries.find(({ tab }) => tab.getAttribute('aria-selected') === 'true') || entries[0];

    let originalTabs = tabList;
    while (originalTabs.parentElement && originalTabs.parentElement !== header) {
      originalTabs = originalTabs.parentElement;
    }
    const originalAriaHidden = originalTabs.getAttribute('aria-hidden');
    const originalStyle = originalTabs.getAttribute('style');
    originalTabs.classList.add('api-example-original-tabs');
    originalTabs.setAttribute('aria-hidden', 'true');
    originalTabs.style.removeProperty('display');

    const controls = document.createElement('div');
    controls.className = 'api-example-selector-bar';
    controls.dataset.kind = kind;

    let secondaryDropdown;
    let syncTimer;
    const syncTimers = [];

    const isVisiblePanel = (panel) => {
      if (panel.hidden || panel.hasAttribute('inert')) return false;
      if (panel.getAttribute('aria-hidden') === 'true' || panel.hasAttribute('data-hidden')) return false;
      const style = window.getComputedStyle(panel);
      return style.display !== 'none' && style.visibility !== 'hidden';
    };

    // During hydration the selected tab can briefly describe a different
    // panel than the one actually being painted. Use the visible panel as the
    // source of truth so the custom selectors never drift from the code.
    const getActiveEntry = () => {
      const panels = [...group.querySelectorAll('[role="tabpanel"]')];
      const visiblePanelIndex = panels.findIndex(isVisiblePanel);
      const visiblePanel = panels[visiblePanelIndex];
      const panelIndex = Number(visiblePanel?.getAttribute('data-index'));
      if (Number.isInteger(panelIndex) && panelIndex >= 0 && entries[panelIndex]) {
        return entries[panelIndex];
      }
      if (visiblePanelIndex >= 0 && entries[visiblePanelIndex]) {
        return entries[visiblePanelIndex];
      }
      return entries.find(({ tab }) => tab.getAttribute('aria-selected') === 'true') || entries[0];
    };

    const initialEntry = getActiveEntry() || activeEntry;
    let primaryValue = initialEntry.primary;
    let secondaryValue = initialEntry.secondary;

    const syncFromActiveTab = () => {
      const active = getActiveEntry();
      if (!active) return;
      primaryValue = active.primary;
      secondaryValue = active.secondary;
      primary.setValue(active.primary);
      const secondaryValues = unique(
        entries.filter((entry) => entry.primary === active.primary).map((entry) => entry.secondary),
      );
      if (secondaryDropdown) {
        secondaryDropdown.setOptions(secondaryValues);
        secondaryDropdown.setValue(active.secondary);
      }
    };

    const scheduleSync = () => {
      clearTimeout(syncTimer);
      syncTimer = setTimeout(syncFromActiveTab, 0);
    };

    const activate = () => {
      const match = entries.find(
        (entry) => entry.primary === primaryValue && entry.secondary === secondaryValue,
      ) || entries.find((entry) => entry.primary === primaryValue) || entries[0];
      primaryValue = match.primary;
      secondaryValue = match.secondary;
      if (match.tab.getAttribute('aria-selected') !== 'true') match.tab.click();
      if (secondaryDropdown) secondaryDropdown.setValue(secondaryValue);
      scheduleSync();
    };

    const primary = createDropdown(
      kind === 'request' ? 'Code language' : 'Response status',
      unique(entries.map((entry) => entry.primary)),
      primaryValue,
      (value) => {
      primaryValue = value;
      const secondaryValues = unique(
        entries.filter((entry) => entry.primary === value).map((entry) => entry.secondary),
      );
        if (secondaryDropdown) {
          secondaryDropdown.setOptions(secondaryValues);
        }
        secondaryValue = secondaryValues.includes(secondaryValue)
          ? secondaryValue
          : secondaryValues[0] || '';
        activate();
      },
    );
    controls.appendChild(primary.wrapper);

    const initialSecondaryValues = unique(
      entries.filter((entry) => entry.primary === primaryValue).map((entry) => entry.secondary),
    );
    const allSecondaryValues = unique(entries.map((entry) => entry.secondary));
    if (allSecondaryValues.length > 1) {
      const secondary = createDropdown(
        kind === 'request' ? 'Request example' : 'Response example',
        initialSecondaryValues,
        secondaryValue,
        (value) => {
          secondaryValue = value;
          activate();
        },
      );
      secondaryDropdown = secondary;
      controls.appendChild(secondary.wrapper);
    }

    header.insertBefore(controls, originalTabs);
    header.querySelectorAll('button[aria-label="Select language"]').forEach((button) => {
      button.style.setProperty('display', 'none', 'important');
    });

    entries.forEach((entry) => {
      entry.tab.addEventListener('click', scheduleSync);
    });

    group.__apiSelectorState = {
      tabList,
      tabs,
      originalTabs,
      originalAriaHidden,
      originalStyle,
      onTabClick: scheduleSync,
      syncFromActiveTab,
      syncTimers,
      get syncTimer() { return syncTimer; },
    };

    [0, 100, 500, 1000, 1500].forEach((delay) => {
      syncTimers.push(setTimeout(syncFromActiveTab, delay));
    });

    group.dataset.apiSelectorReady = ENHANCER_VERSION;
  };

  const enhanceExamples = () => {
    document.querySelectorAll('#request-example .code-group').forEach((group) => {
      enhanceCodeGroup(group, 'request');
    });
    document.querySelectorAll('#response-example .code-group').forEach((group) => {
      enhanceCodeGroup(group, 'response');
    });
    document.querySelectorAll('[data-api-example]').forEach((panel) => {
      const groups = [...panel.querySelectorAll('.code-group')];
      groups.forEach((group, index) => {
        const firstLabel = group.querySelector('[role="tab"]')?.textContent.trim() || '';
        const kind = /^(\d{3}|default)\b/i.test(firstLabel)
          ? 'response'
          : index === 0 ? 'request' : 'response';
        enhanceCodeGroup(group, kind);
      });
    });
  };

  document.addEventListener('click', () => {
    document.querySelectorAll('.api-example-menu:not([hidden])').forEach((menu) => {
      menu.hidden = true;
      menu.previousElementSibling?.setAttribute('aria-expanded', 'false');
      menu.parentElement?.classList.remove('is-open');
    });
  });

  enhanceExamples();
  let enhanceTimer;
  const scheduleEnhance = () => {
    clearTimeout(enhanceTimer);
    enhanceTimer = setTimeout(enhanceExamples, 0);
  };
  new MutationObserver((mutations) => {
    const relevant = mutations.some((mutation) => {
      const target = mutation.target instanceof Element ? mutation.target : null;
      if (target?.closest('.api-example-selector-bar')) return false;
      if (mutation.type === 'attributes') {
        return Boolean(target?.closest('.code-group'));
      }
      return Boolean(target?.closest('.code-group'))
        || [...mutation.addedNodes].some((node) => node instanceof Element && (
          node.matches('.code-group, [data-component-part="code-group-tab-bar"]')
          || Boolean(node.querySelector('.code-group, [data-component-part="code-group-tab-bar"]'))
        ));
    });
    if (relevant) scheduleEnhance();
  }).observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['aria-selected', 'aria-hidden', 'data-hidden', 'data-index', 'hidden', 'inert'],
  });
})();
