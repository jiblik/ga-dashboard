document.addEventListener('DOMContentLoaded', () => {
  const startDateInput = document.getElementById('startDate');
  const endDateInput = document.getElementById('endDate');
  const fetchBtn = document.getElementById('fetchBtn');
  const searchInput = document.getElementById('searchInput');
  const exportBtn = document.getElementById('exportBtn');
  const tableBody = document.getElementById('tableBody');
  const summaryCards = document.getElementById('summaryCards');
  const loading = document.getElementById('loading');
  const errorMsg = document.getElementById('errorMsg');
  const tableWrapper = document.getElementById('tableWrapper');
  const emptyState = document.getElementById('emptyState');
  const chartsSection = document.getElementById('chartsSection');
  const sourceSummary = document.getElementById('sourceSummary');
  const sourceSummaryBody = document.getElementById('sourceSummaryBody');
  const paginationInfo = document.getElementById('paginationInfo');
  const paginationEl = document.getElementById('pagination');

  let allRows = [];
  let filteredRows = [];
  let sortCol = 'date';
  let sortDir = 'desc';
  let currentPage = 1;
  const rowsPerPage = 50;

  let pieChart = null;
  let lineChart = null;

  // Set default dates: last 30 days
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(today.getDate() - 30);
  endDateInput.value = formatDateForInput(today);
  startDateInput.value = formatDateForInput(thirtyDaysAgo);

  function formatDateForInput(date) {
    return date.toISOString().split('T')[0];
  }

  function formatCurrency(amount) {
    return '\u20AA' + amount.toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // Source color mapping
  const sourceColors = {
    google: { bg: '#e8f5e9', text: '#2e7d32', chart: '#4caf50' },
    facebook: { bg: '#e3f2fd', text: '#1565c0', chart: '#1877f2' },
    fb: { bg: '#e3f2fd', text: '#1565c0', chart: '#1877f2' },
    meta: { bg: '#e3f2fd', text: '#1565c0', chart: '#1877f2' },
    ig: { bg: '#e3f2fd', text: '#1565c0', chart: '#1877f2' },
    instagram: { bg: '#e3f2fd', text: '#1565c0', chart: '#1877f2' },
    direct: { bg: '#f3e5f5', text: '#7b1fa2', chart: '#9c27b0' },
    '(direct)': { bg: '#f3e5f5', text: '#7b1fa2', chart: '#9c27b0' },
    tiktok: { bg: '#fce4ec', text: '#c62828', chart: '#fe2c55' },
    email: { bg: '#fff3e0', text: '#e65100', chart: '#ff9800' },
    newsletter: { bg: '#fff3e0', text: '#e65100', chart: '#ff9800' },
    mailchimp: { bg: '#fff3e0', text: '#e65100', chart: '#ff9800' },
    bing: { bg: '#e0f2f1', text: '#00695c', chart: '#009688' },
    youtube: { bg: '#ffebee', text: '#b71c1c', chart: '#ff0000' },
    twitter: { bg: '#e8eaf6', text: '#283593', chart: '#1da1f2' },
    x: { bg: '#e8eaf6', text: '#283593', chart: '#1da1f2' },
  };

  const defaultColor = { bg: '#f5f5f5', text: '#616161', chart: '#9e9e9e' };

  // Predefined chart colors for sources without a specific mapping
  const chartPalette = [
    '#4caf50', '#1877f2', '#9c27b0', '#fe2c55', '#ff9800',
    '#009688', '#ff0000', '#1da1f2', '#795548', '#607d8b',
    '#e91e63', '#00bcd4', '#8bc34a', '#ff5722', '#3f51b5',
  ];

  function getSourceColor(source) {
    const key = (source || '').toLowerCase().replace(/[^a-z0-9()]/g, '');
    return sourceColors[key] || defaultColor;
  }

  function getSourceBadgeClass(source) {
    const key = (source || '').toLowerCase().replace(/[^a-z]/g, '');
    const known = ['google', 'facebook', 'fb', 'meta', 'ig', 'instagram', 'direct', 'tiktok', 'email', 'newsletter', 'mailchimp', 'bing', 'youtube', 'twitter', 'x'];
    return known.includes(key) ? `source-badge source-${key}` : 'source-badge source-default';
  }

  // Fetch data
  fetchBtn.addEventListener('click', fetchData);

  // Auto-load on page open
  fetchData();

  async function fetchData() {
    const startDate = startDateInput.value;
    const endDate = endDateInput.value;

    if (!startDate || !endDate) {
      showError('\u05D9\u05E9 \u05DC\u05D1\u05D7\u05D5\u05E8 \u05EA\u05D0\u05E8\u05D9\u05DA \u05D4\u05EA\u05D7\u05DC\u05D4 \u05D5\u05EA\u05D0\u05E8\u05D9\u05DA \u05E1\u05D9\u05D5\u05DD');
      return;
    }

    // Show loading
    loading.style.display = 'block';
    tableWrapper.style.display = 'none';
    summaryCards.style.display = 'none';
    chartsSection.style.display = 'none';
    sourceSummary.style.display = 'none';
    errorMsg.style.display = 'none';
    emptyState.style.display = 'none';
    fetchBtn.disabled = true;

    try {
      const resp = await fetch(`/api/report?startDate=${startDate}&endDate=${endDate}`);
      const data = await resp.json();

      if (!resp.ok) {
        throw new Error(data.details || data.error || 'Unknown error');
      }

      allRows = data.rows;
      filteredRows = [...allRows];
      currentPage = 1;

      // Update summary
      document.getElementById('totalRevenue').textContent = formatCurrency(data.totals.totalRevenue);
      document.getElementById('totalTransactions').textContent = data.totals.totalTransactions.toLocaleString();
      document.getElementById('totalItems').textContent = data.totals.totalItems.toLocaleString();

      const avg = data.totals.totalTransactions > 0
        ? data.totals.totalRevenue / data.totals.totalTransactions
        : 0;
      document.getElementById('avgTransaction').textContent = formatCurrency(avg);

      if (allRows.length === 0) {
        emptyState.style.display = 'block';
      } else {
        summaryCards.style.display = 'grid';
        chartsSection.style.display = 'block';
        sourceSummary.style.display = 'block';
        tableWrapper.style.display = 'block';
        applySort();
        renderTable();
        renderSourceSummary();
        renderCharts();
      }
    } catch (err) {
      showError(err.message);
    } finally {
      loading.style.display = 'none';
      fetchBtn.disabled = false;
    }
  }

  function showError(msg) {
    errorMsg.textContent = msg;
    errorMsg.style.display = 'block';
  }

  // Search / Filter
  searchInput.addEventListener('input', () => {
    const query = searchInput.value.trim().toLowerCase();
    if (!query) {
      filteredRows = [...allRows];
    } else {
      filteredRows = allRows.filter((row) =>
        Object.values(row).some((val) =>
          String(val).toLowerCase().includes(query)
        )
      );
    }
    currentPage = 1;
    applySort();
    renderTable();
  });

  // Sort
  document.querySelectorAll('th.sortable').forEach((th) => {
    th.addEventListener('click', () => {
      const col = th.dataset.col;
      if (sortCol === col) {
        sortDir = sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        sortCol = col;
        sortDir = 'asc';
      }

      // Update sort indicators
      document.querySelectorAll('th.sortable').forEach((h) => {
        h.classList.remove('asc', 'desc');
      });
      th.classList.add(sortDir);

      currentPage = 1;
      applySort();
      renderTable();
    });
  });

  function applySort() {
    filteredRows.sort((a, b) => {
      let valA = a[sortCol];
      let valB = b[sortCol];

      // Numeric sort for revenue
      if (sortCol === 'revenue') {
        valA = Number(valA);
        valB = Number(valB);
      } else {
        valA = String(valA).toLowerCase();
        valB = String(valB).toLowerCase();
      }

      if (valA < valB) return sortDir === 'asc' ? -1 : 1;
      if (valA > valB) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }

  function renderTable() {
    tableBody.innerHTML = '';

    const totalPages = Math.ceil(filteredRows.length / rowsPerPage);
    if (currentPage > totalPages) currentPage = totalPages || 1;

    const start = (currentPage - 1) * rowsPerPage;
    const end = Math.min(start + rowsPerPage, filteredRows.length);
    const pageRows = filteredRows.slice(start, end);

    paginationInfo.textContent = `${start + 1}-${end} \u05DE\u05EA\u05D5\u05DA ${filteredRows.length}`;

    pageRows.forEach((row) => {
      const tr = document.createElement('tr');

      const utmEmpty = (val) => (!val || val === '(not set)' || val === '(none)');

      const sourceBadge = (val) => {
        if (utmEmpty(val)) return '<span class="empty-utm">-</span>';
        return `<span class="${getSourceBadgeClass(val)}">${escapeHtml(val)}</span>`;
      };

      tr.innerHTML = `
        <td>${escapeHtml(row.date)}</td>
        <td>${escapeHtml(row.transactionId)}</td>
        <td>${sourceBadge(row.firstSource)}</td>
        <td class="${utmEmpty(row.firstMedium) ? 'empty-utm' : ''}">${utmEmpty(row.firstMedium) ? '-' : escapeHtml(row.firstMedium)}</td>
        <td class="${utmEmpty(row.firstCampaign) ? 'empty-utm' : ''}">${utmEmpty(row.firstCampaign) ? '-' : escapeHtml(row.firstCampaign)}</td>
        <td>${sourceBadge(row.source)}</td>
        <td class="${utmEmpty(row.medium) ? 'empty-utm' : ''}">${utmEmpty(row.medium) ? '-' : escapeHtml(row.medium)}</td>
        <td class="${utmEmpty(row.campaign) ? 'empty-utm' : ''}">${utmEmpty(row.campaign) ? '-' : escapeHtml(row.campaign)}</td>
        <td>${escapeHtml(row.itemName)}</td>
        <td class="revenue">${formatCurrency(row.revenue)}</td>
      `;
      tableBody.appendChild(tr);
    });

    renderPagination(totalPages);
  }

  function renderPagination(totalPages) {
    paginationEl.innerHTML = '';
    if (totalPages <= 1) return;

    // Previous button
    const prevBtn = document.createElement('button');
    prevBtn.textContent = '\u2190';
    prevBtn.disabled = currentPage === 1;
    prevBtn.addEventListener('click', () => { currentPage--; renderTable(); });
    paginationEl.appendChild(prevBtn);

    // Page buttons
    const maxButtons = 7;
    let startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2));
    let endPage = Math.min(totalPages, startPage + maxButtons - 1);
    if (endPage - startPage < maxButtons - 1) {
      startPage = Math.max(1, endPage - maxButtons + 1);
    }

    if (startPage > 1) {
      addPageBtn(1);
      if (startPage > 2) {
        const dots = document.createElement('span');
        dots.textContent = '...';
        dots.style.padding = '0 8px';
        dots.style.color = '#9ca3af';
        paginationEl.appendChild(dots);
      }
    }

    for (let i = startPage; i <= endPage; i++) {
      addPageBtn(i);
    }

    if (endPage < totalPages) {
      if (endPage < totalPages - 1) {
        const dots = document.createElement('span');
        dots.textContent = '...';
        dots.style.padding = '0 8px';
        dots.style.color = '#9ca3af';
        paginationEl.appendChild(dots);
      }
      addPageBtn(totalPages);
    }

    // Next button
    const nextBtn = document.createElement('button');
    nextBtn.textContent = '\u2192';
    nextBtn.disabled = currentPage === totalPages;
    nextBtn.addEventListener('click', () => { currentPage++; renderTable(); });
    paginationEl.appendChild(nextBtn);

    function addPageBtn(page) {
      const btn = document.createElement('button');
      btn.textContent = page;
      if (page === currentPage) btn.classList.add('active');
      btn.addEventListener('click', () => { currentPage = page; renderTable(); });
      paginationEl.appendChild(btn);
    }
  }

  // Source Summary Table
  function renderSourceSummary() {
    sourceSummaryBody.innerHTML = '';

    // Group by source + medium
    const groups = {};
    allRows.forEach((row) => {
      const src = row.firstSource || '(not set)';
      const med = row.firstMedium || '(not set)';
      const key = `${src}|||${med}`;
      if (!groups[key]) {
        groups[key] = { source: src, medium: med, revenue: 0, transactions: new Set() };
      }
      groups[key].revenue += row.revenue;
      groups[key].transactions.add(row.transactionId);
    });

    const totalRevenue = allRows.reduce((sum, r) => sum + r.revenue, 0);

    // Sort by revenue descending
    const sorted = Object.values(groups).sort((a, b) => b.revenue - a.revenue);

    sorted.forEach((g) => {
      const pct = totalRevenue > 0 ? (g.revenue / totalRevenue * 100) : 0;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><span class="${getSourceBadgeClass(g.source)}">${escapeHtml(g.source)}</span></td>
        <td>${escapeHtml(g.medium)}</td>
        <td>${g.transactions.size.toLocaleString()}</td>
        <td class="revenue">${formatCurrency(g.revenue)}</td>
        <td><span class="pct-bar" style="width:${Math.max(pct, 1)}%"></span> ${pct.toFixed(1)}%</td>
      `;
      sourceSummaryBody.appendChild(tr);
    });
  }

  // Charts
  function renderCharts() {
    renderPieChart();
    renderLineChart();
  }

  function renderPieChart() {
    // Group by source
    const groups = {};
    allRows.forEach((row) => {
      const src = row.firstSource || '(not set)';
      if (!groups[src]) groups[src] = 0;
      groups[src] += row.revenue;
    });

    const sorted = Object.entries(groups).sort((a, b) => b[1] - a[1]);
    // Show top 8, rest as "other"
    const top = sorted.slice(0, 8);
    const otherRevenue = sorted.slice(8).reduce((sum, [, v]) => sum + v, 0);
    if (otherRevenue > 0) top.push(['\u05D0\u05D7\u05E8', otherRevenue]);

    const labels = top.map(([k]) => k);
    const data = top.map(([, v]) => Math.round(v * 100) / 100);
    const colors = top.map(([k], i) => {
      const c = getSourceColor(k);
      return c !== defaultColor ? c.chart : chartPalette[i % chartPalette.length];
    });

    const ctx = document.getElementById('pieChart').getContext('2d');
    if (pieChart) pieChart.destroy();
    pieChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: colors,
          borderWidth: 2,
          borderColor: '#fff',
        }],
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: 'right',
            rtl: true,
            labels: { font: { size: 12 }, padding: 12 },
          },
          tooltip: {
            rtl: true,
            callbacks: {
              label: (ctx) => `${ctx.label}: \u20AA${ctx.parsed.toLocaleString('he-IL', { minimumFractionDigits: 2 })}`,
            },
          },
        },
      },
    });
  }

  function renderLineChart() {
    // Group by date
    const groups = {};
    allRows.forEach((row) => {
      if (!groups[row.date]) groups[row.date] = 0;
      groups[row.date] += row.revenue;
    });

    const sorted = Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
    const labels = sorted.map(([k]) => k);
    const data = sorted.map(([, v]) => Math.round(v * 100) / 100);

    const ctx = document.getElementById('lineChart').getContext('2d');
    if (lineChart) lineChart.destroy();
    lineChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: '\u05D4\u05DB\u05E0\u05E1\u05D5\u05EA',
          data,
          borderColor: '#4f46e5',
          backgroundColor: 'rgba(79, 70, 229, 0.1)',
          fill: true,
          tension: 0.3,
          pointRadius: 3,
          pointHoverRadius: 6,
        }],
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          tooltip: {
            rtl: true,
            callbacks: {
              label: (ctx) => `\u20AA${ctx.parsed.y.toLocaleString('he-IL', { minimumFractionDigits: 2 })}`,
            },
          },
        },
        scales: {
          x: {
            ticks: { maxTicksLimit: 15, font: { size: 11 } },
          },
          y: {
            beginAtZero: true,
            ticks: {
              callback: (v) => '\u20AA' + v.toLocaleString(),
              font: { size: 11 },
            },
          },
        },
      },
    });
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // Export CSV
  exportBtn.addEventListener('click', () => {
    if (filteredRows.length === 0) return;

    const headers = ['\u05EA\u05D0\u05E8\u05D9\u05DA', '\u05DE\u05D6\u05D4\u05D4 \u05E2\u05E1\u05E7\u05D4', '\u05DE\u05E7\u05D5\u05E8 \u05E8\u05D0\u05E9\u05D5\u05DF', '\u05E2\u05E8\u05D5\u05E5 \u05E8\u05D0\u05E9\u05D5\u05DF', '\u05E7\u05DE\u05E4\u05D9\u05D9\u05DF \u05E8\u05D0\u05E9\u05D5\u05DF', '\u05DE\u05E7\u05D5\u05E8 \u05E1\u05E9\u05DF', '\u05E2\u05E8\u05D5\u05E5 \u05E1\u05E9\u05DF', '\u05E7\u05DE\u05E4\u05D9\u05D9\u05DF (UTM)', '\u05E9\u05DD \u05DE\u05D5\u05E6\u05E8', '\u05D4\u05DB\u05E0\u05E1\u05D4'];
    const keys = ['date', 'transactionId', 'firstSource', 'firstMedium', 'firstCampaign', 'source', 'medium', 'campaign', 'itemName', 'revenue'];

    const csvRows = [
      // BOM for Hebrew support in Excel
      headers.join(','),
      ...filteredRows.map((row) =>
        keys.map((k) => {
          let val = row[k];
          // Wrap in quotes if contains comma or quotes
          val = String(val).replace(/"/g, '""');
          return `"${val}"`;
        }).join(',')
      ),
    ];

    const csvContent = '\uFEFF' + csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `purchases_${startDateInput.value}_to_${endDateInput.value}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  });
});
