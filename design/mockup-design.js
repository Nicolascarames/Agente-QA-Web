/*
 * Componente `<script type="text/x-dc" data-dc-script="">` del mockup, líneas 866–1122
 * de `design/mockup.html` (el HTML desempaquetado). Es la referencia de estado inicial,
 * geometría de paneles por pestaña (`panels.<pestana>`, en % del contenedor) y textos
 * de atrezo (chats de ejemplo). No se ejecuta en este repo — `DCLogic` es el runtime
 * del bundler de Claude Design y no existe aquí. Ver `design/README.md` para cómo se
 * regenera este fichero.
 */
class Component extends DCLogic {
  constructor(props) {
    super(props);
    const mk = (x, y, w, h) => ({ x, y, w, h, z: 1 });
    this.state = {
      activePage: 'dashboard',
      isMobile: (typeof window !== 'undefined' ? window.innerWidth < 900 : false),
      sidebarOpen: false,
      booting: true,
      agentTab: { explorar: 'crawler', redactar: 'redactor', generar: 'generador' },
      subtab: { generar: 'go-po' },
      chatInput: { explorar: '', redactar: '', generar: '', ejecutar: '', reparar: '' },
      chatLoading: { explorar: false, redactar: false, generar: false, ejecutar: false, reparar: false },
      opLoading: { explorar: false, redactar: false, generar: false, ejecutar: false, reparar: false },
      opDone: { explorar: false, redactar: false, generar: false, ejecutar: false, reparar: false },
      chats: {
        explorar: [
          { ai: true, who: 'mapeador-mcp', text: 'He detectado una SPA. Separo routes de screen states para que los escenarios representen transiciones sin navegación.' },
          { ai: false, who: 'Tú', text: '¿Qué falta para automatizar Create User?' },
          { ai: true, who: 'mapeador-mcp', text: 'El botón Create tiene 2 coincidencias. Puedo resolverlo si me lo pides.' }
        ],
        redactar: [
          { ai: false, who: 'Tú', text: 'Quiero probar un registro con email duplicado.' },
          { ai: true, who: 'redactor', text: 'Ya existe "Users List" y el formulario de alta en el mapa. ¿Añado el caso a create-user.feature o creo uno nuevo?' }
        ],
        generar: [
          { ai: true, who: 'generador', text: 'Genero sobre la plantilla de formulario. Los localizadores se reescriben desde el mapa al final — no los invento yo.' }
        ],
        ejecutar: [
          { ai: true, who: 'Informador', text: '9 de 10 tests en verde. 1 fallo: Duplicate email, locator ambiguo (2 matches).' },
          { ai: false, who: 'Tú', text: '¿por qué falló?' }
        ],
        reparar: [
          { ai: true, who: 'Reparador', text: 'He analizado el fallo, el DOM y el trace. El botón "Create" matchea 2 elementos dentro de un modal SPA.' },
          { ai: false, who: 'Tú', text: '¿es seguro cambiarlo?' },
          { ai: true, who: 'Reparador', text: 'Sí, el nuevo locator devuelve 1 elemento. Confianza 96%.' }
        ]
      },
      panels: {
        dashboard: { s0: mk(0, 0, 15.3, 15), s1: mk(16.8, 0, 15.3, 15), s2: mk(33.6, 0, 15.3, 15), s3: mk(50.4, 0, 15.3, 15), s4: mk(67.2, 0, 15.3, 15), s5: mk(84, 0, 15.3, 15), cur: mk(0, 20, 48, 78), act: mk(51, 20, 49, 78) },
        reports: { s0: mk(0, 0, 32, 34), s1: mk(34, 0, 32, 34), s2: mk(68, 0, 32, 34), filt: mk(0, 38, 100, 15), causes: mk(0, 57, 48, 41), hist: mk(51, 57, 49, 41) },
        config: { proj: mk(0, 0, 48, 100), global: mk(51, 0, 49, 100) },
        explorar: { left: mk(0, 0, 25, 100), mid: mk(26.5, 0, 46, 100), right: mk(74, 0, 26, 100) },
        redactar: { left: mk(0, 0, 25, 100), mid: mk(26.5, 0, 46, 100), right: mk(74, 0, 26, 100) },
        generar: { left: mk(0, 0, 25, 100), mid: mk(26.5, 0, 46, 100), right: mk(74, 0, 26, 100) },
        ejecutar: { left: mk(0, 0, 25, 100), mid: mk(26.5, 0, 46, 100), right: mk(74, 0, 26, 100) },
        reparar: { left: mk(0, 0, 25, 100), mid: mk(26.5, 0, 46, 100), right: mk(74, 0, 26, 100) }
      }
    };
    this.zCounter = 10;
    this._resize = this._resize.bind(this);
  }
  componentDidMount() {
    window.addEventListener('resize', this._resize);
    this._resize();
    setTimeout(() => this.setState({ booting: false }), 700);
  }
  componentWillUnmount() {
    window.removeEventListener('resize', this._resize);
  }
  _resize() {
    const mobile = window.innerWidth < 900;
    if (mobile !== this.state.isMobile) this.setState({ isMobile: mobile });
  }
  go(page) {
    this.setState({ activePage: page, sidebarOpen: false });
    const el = document.getElementById('qa-agent-content-scroll');
    if (el) el.scrollTop = 0;
  }
  toggleSidebar() { this.setState(s => ({ sidebarOpen: !s.sidebarOpen })); }
  closeSidebar() { this.setState({ sidebarOpen: false }); }
  selectAgentTab(page, tab) { this.setState(s => ({ agentTab: { ...s.agentTab, [page]: tab } })); }
  selectSubtab(page, tab) { this.setState(s => ({ subtab: { ...s.subtab, [page]: tab } })); }
  setChatInput(page, val) { this.setState(s => ({ chatInput: { ...s.chatInput, [page]: val } })); }
  sendChat(page) {
    const text = (this.state.chatInput[page] || '').trim();
    if (!text) return;
    this.setState(s => ({
      chats: { ...s.chats, [page]: [...s.chats[page], { ai: false, who: 'Tú', text }] },
      chatInput: { ...s.chatInput, [page]: '' },
      chatLoading: { ...s.chatLoading, [page]: true }
    }));
    const replies = { explorar: 'Reviso el mapa y te confirmo en un momento.', redactar: 'Anotado — lo reflejo en el escenario.', generar: 'Reviso la plantilla y regenero si hace falta.', ejecutar: 'Consultando el trace del run…', reparar: 'Comparando con localizadores similares…' };
    setTimeout(() => {
      this.setState(s => ({
        chats: { ...s.chats, [page]: [...s.chats[page], { ai: true, who: this.state.agentTab[page] || 'agente', text: replies[page] || 'Ok.' }] },
        chatLoading: { ...s.chatLoading, [page]: false }
      }));
    }, 900);
  }
  runOp(page) {
    if (this.state.opLoading[page]) return;
    this.setState(s => ({ opLoading: { ...s.opLoading, [page]: true }, opDone: { ...s.opDone, [page]: false } }));
    setTimeout(() => {
      this.setState(s => ({ opLoading: { ...s.opLoading, [page]: false }, opDone: { ...s.opDone, [page]: true } }));
      setTimeout(() => this.setState(s => ({ opDone: { ...s.opDone, [page]: false } })), 1800);
    }, 1100);
  }
  clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
  startDrag(page, id, e) {
    if (this.state.isMobile) return;
    e.preventDefault(); e.stopPropagation();
    const canvasEl = e.currentTarget.closest('[data-canvas]');
    if (!canvasEl) return;
    const rect = canvasEl.getBoundingClientRect();
    const p = this.state.panels[page][id];
    const startX = e.clientX, startY = e.clientY, ox = p.x, oy = p.y;
    this.zCounter++;
    const z = this.zCounter;
    this.setState(s => ({ panels: { ...s.panels, [page]: { ...s.panels[page], [id]: { ...s.panels[page][id], z } } } }));
    const onMove = (ev) => {
      const dx = (ev.clientX - startX) / rect.width * 100;
      const dy = (ev.clientY - startY) / rect.height * 100;
      const nx = this.clamp(ox + dx, 0, 100 - p.w);
      const ny = this.clamp(oy + dy, 0, 100 - p.h);
      this.setState(s => ({ panels: { ...s.panels, [page]: { ...s.panels[page], [id]: { ...s.panels[page][id], x: nx, y: ny } } } }));
    };
    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }
  startResize(page, id, e) {
    if (this.state.isMobile) return;
    e.preventDefault(); e.stopPropagation();
    const canvasEl = e.currentTarget.closest('[data-canvas]');
    if (!canvasEl) return;
    const rect = canvasEl.getBoundingClientRect();
    const p = this.state.panels[page][id];
    const startX = e.clientX, startY = e.clientY, ow = p.w, oh = p.h;
    this.zCounter++;
    const z = this.zCounter;
    this.setState(s => ({ panels: { ...s.panels, [page]: { ...s.panels[page], [id]: { ...s.panels[page][id], z } } } }));
    const minW = 10, minH = 12;
    const onMove = (ev) => {
      const dw = (ev.clientX - startX) / rect.width * 100;
      const dh = (ev.clientY - startY) / rect.height * 100;
      const nw = this.clamp(ow + dw, minW, 100 - p.x);
      const nh = this.clamp(oh + dh, minH, 100 - p.y);
      this.setState(s => ({ panels: { ...s.panels, [page]: { ...s.panels[page], [id]: { ...s.panels[page][id], w: nw, h: nh } } } }));
    };
    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }
  panelStyleFor(page, id) {
    const p = this.state.panels[page][id];
    if (this.state.isMobile) {
      return { position: 'relative', width: '100%', height: 380, marginBottom: 12, zIndex: 1 };
    }
    return { position: 'absolute', left: p.x + '%', top: p.y + '%', width: p.w + '%', height: p.h + '%', zIndex: p.z || 1 };
  }
  renderVals() {
    const S = this.state;
    const navMeta = {
      dashboard: { icon: '📊', label: 'Dashboard' }, explorar: { icon: '🗺️', label: 'Explorar' },
      redactar: { icon: '✍️', label: 'Redactar' }, generar: { icon: '🧪', label: 'Generar' },
      ejecutar: { icon: '▶️', label: 'Ejecutar' }, reparar: { icon: '🔧', label: 'Reparar' },
      reports: { icon: '📈', label: 'Reports' }, config: { icon: '⚙️', label: 'Configuración' }
    };
    const navStyle = (id) => ({
      display: 'flex', alignItems: 'center', gap: 8, width: '100%', border: '0',
      background: S.activePage === id ? 'rgba(245,166,35,.14)' : 'transparent',
      color: S.activePage === id ? '#f5c877' : '#a9b4c0', textAlign: 'left', padding: '9px 10px',
      borderRadius: 8, fontSize: 12, fontFamily: 'inherit', fontWeight: S.activePage === id ? 600 : 400, cursor: 'pointer'
    });
    const navTop = ['dashboard', 'explorar', 'redactar', 'generar', 'ejecutar', 'reparar'].map(id => ({
      id, icon: navMeta[id].icon, label: navMeta[id].label, style: navStyle(id), onClick: () => this.go(id)
    }));
    const reportsNavItem = { icon: navMeta.reports.icon, label: navMeta.reports.label, style: navStyle('reports'), onClick: () => this.go('reports') };
    const configNavItem = { icon: navMeta.config.icon, label: navMeta.config.label, style: navStyle('config'), onClick: () => this.go('config') };

    const pages = ['dashboard', 'reports', 'config', 'explorar', 'redactar', 'generar', 'ejecutar', 'reparar'];
    const panelStyle = {}; const handlers = {};
    pages.forEach(pg => {
      panelStyle[pg] = {}; handlers[pg] = {};
      Object.keys(S.panels[pg]).forEach(id => {
        panelStyle[pg][id] = this.panelStyleFor(pg, id);
        handlers[pg][id] = { onDragStart: (e) => this.startDrag(pg, id, e), onResizeStart: (e) => this.startResize(pg, id, e) };
      });
    });

    const statDefs = [
      { id: 's0', label: 'Pantallas', value: '14', color: '#e8edf5' },
      { id: 's1', label: 'Locators', value: '62', color: '#e8edf5' },
      { id: 's2', label: 'Features', value: '8', color: '#e8edf5' },
      { id: 's3', label: 'Escenarios', value: '23', color: '#e8edf5' },
      { id: 's4', label: 'Tests', value: '41', color: '#e8edf5' },
      { id: 's5', label: 'Pass rate', value: '86%', color: '#52d17c' }
    ].map(d => ({ ...d, panelStyle: panelStyle.dashboard[d.id], dragHandler: handlers.dashboard[d.id].onDragStart, resizeHandler: handlers.dashboard[d.id].onResizeStart }));

    const reportStatDefs = [
      { id: 's0', label: 'Pass rate', value: '86%', color: '#52d17c', spark: true },
      { id: 's1', label: 'Flaky tests', value: '7', color: '#e5c668', spark: false },
      { id: 's2', label: 'Fallos abiertos', value: '15', color: '#ff7f88', spark: false }
    ].map(d => ({ ...d, panelStyle: panelStyle.reports[d.id], dragHandler: handlers.reports[d.id].onDragStart, resizeHandler: handlers.reports[d.id].onResizeStart }));

    const chatViews = {};
    ['explorar', 'redactar', 'generar', 'ejecutar', 'reparar'].forEach(pg => {
      chatViews[pg] = {
        messages: S.chats[pg].map(m => ({ ...m, notAi: !m.ai })),
        input: S.chatInput[pg], loading: S.chatLoading[pg],
        onInput: (e) => this.setChatInput(pg, e.target.value),
        onSend: () => this.sendChat(pg),
        onKeyDown: (e) => { if (e.key === 'Enter') this.sendChat(pg); }
      };
    });

    const ops = {};
    ['explorar', 'redactar', 'generar', 'ejecutar', 'reparar'].forEach(pg => {
      ops[pg] = { loading: S.opLoading[pg], done: S.opDone[pg], idle: !S.opLoading[pg] && !S.opDone[pg], onRun: () => this.runOp(pg) };
    });

    const tabStyle = (sel) => ({
      flex: 1, border: '1px solid #232c37', background: sel ? '#233042' : '#12171f',
      color: sel ? '#fff' : '#8794a3', borderRadius: '6px 6px 0 0', padding: '6px', fontSize: 9,
      fontFamily: 'inherit', cursor: 'pointer', borderBottomColor: sel ? '#233042' : '#232c37'
    });
    const agentTabsExplorar = ['crawler', 'mapeador-mcp'].map(t => ({ id: t, label: t, style: tabStyle(S.agentTab.explorar === t), onClick: () => this.selectAgentTab('explorar', t) }));
    const agentTabsRedactar = ['redactor', 'redactor-mcp'].map(t => ({ id: t, label: t, style: tabStyle(S.agentTab.redactar === t), onClick: () => this.selectAgentTab('redactar', t) }));
    const agentTabsGenerar = ['generador', 'generador-mcp'].map(t => ({ id: t, label: t, style: tabStyle(S.agentTab.generar === t), onClick: () => this.selectAgentTab('generar', t) }));
    const subStyle = (sel) => ({ border: '1px solid #232c37', background: sel ? '#233042' : '#151b23', color: sel ? '#fff' : '#8794a3', borderRadius: 6, padding: '5px 9px', fontSize: 9, fontFamily: 'inherit', cursor: 'pointer' });
    const subtabsGenerar = [{ id: 'go-po', label: 'Page Object' }, { id: 'go-spec', label: 'Spec' }].map(t => ({ ...t, style: subStyle(S.subtab.generar === t.id), onClick: () => this.selectSubtab('generar', t.id) }));

    const canvasHeights = { dashboard: 760, reports: 760, config: 620, explorar: 640, redactar: 640, generar: 640, ejecutar: 640, reparar: 640 };
    const canvasStyle = {};
    Object.keys(canvasHeights).forEach(pg => {
      canvasStyle[pg] = S.isMobile
        ? { position: 'static', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'auto' }
        : { position: 'relative', flex: 1, minHeight: canvasHeights[pg] + 'px' };
    });

    const appGridStyle = S.isMobile
      ? { display: 'block', height: '100vh', width: '100vw', overflow: 'hidden', position: 'relative' }
      : { display: 'grid', gridTemplateColumns: '230px 1fr', height: '100vh', width: '100vw' };
    const sidebarBase = { background: '#0d1117', borderRight: '1px solid #1c2229', display: 'flex', flexDirection: 'column' };
    const sidebarStyle = S.isMobile
      ? { ...sidebarBase, position: 'fixed', top: 0, left: 0, height: '100vh', width: 230, zIndex: 60, transform: S.sidebarOpen ? 'translateX(0)' : 'translateX(-100%)', transition: 'transform .25s ease', boxShadow: S.sidebarOpen ? '20px 0 40px rgba(0,0,0,.5)' : 'none' }
      : { ...sidebarBase, position: 'relative', width: 230, height: '100vh' };
    const backdropStyle = (S.isMobile && S.sidebarOpen) ? { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 55, animation: 'fadeIn .2s ease' } : { display: 'none' };

    return {
      activePage: S.activePage, booting: S.booting, notBooting: !S.booting, isMobile: S.isMobile, notMobile: !S.isMobile,
      isDashboard: S.activePage === 'dashboard', isExplorar: S.activePage === 'explorar', isRedactar: S.activePage === 'redactar',
      isGenerar: S.activePage === 'generar', isEjecutar: S.activePage === 'ejecutar', isReparar: S.activePage === 'reparar',
      isReports: S.activePage === 'reports', isConfig: S.activePage === 'config',
      navTop, reportsNavItem, configNavItem,
      crumbLabel: navMeta[S.activePage].label,
      panelStyle, handlers, statDefs, reportStatDefs, chatViews, ops,
      agentTabsExplorar, agentTabsRedactar, agentTabsGenerar, subtabsGenerar,
      subtabs: { generarPO: S.subtab.generar === 'go-po', generarSpec: S.subtab.generar === 'go-spec' },
      canvasStyle, appGridStyle, sidebarStyle, backdropStyle,
      toggleSidebar: () => this.toggleSidebar(), closeSidebar: () => this.closeSidebar(),
      goEjecutar: () => this.go('ejecutar'), goReparar: () => this.go('reparar')
    };
  }
}
