/**
 * GitHub Repository Showcase Application
 * Modern, interactive web application for displaying GitHub repositories
 */

// Browser compatibility: Define process if it doesn't exist
if (typeof process === 'undefined') {
  window.process = {
    env: {},
    browser: true
  };
}

class GitHubShowcase {
  constructor() {
    this.state = {
      repositories: [],
      filteredRepositories: [],
      searchTerm: '',
      selectedLanguage: '',
      sortBy: 'recent-likes',
      sortOrder: 'desc',
      isLoading: true,
      languages: [],
      error: null,
      languageCategory: 'recently' // 'popular' or 'recently'
    };

    this.elements = {};
    this.debounceTimer = null;
    this.animationFrame = null;
    this.performanceMetrics = {
      loadStartTime: performance.now(),
      searchTimes: [],
      renderTimes: []
    };
    this.intersectionObserver = null;
    this.mutationObserver = null;
  }

  /**
   * Initialize the application
   */
  async init() {
    try {
      this.cacheElements();
      this.bindEvents();
      this.initializeAnimations();
      this.initializeAccessibility();
      this.initializeOptimizations();
      await this.loadData();
      this.render();
      this.initializeScrollAnimations();
    } catch (error) {
      console.error('Failed to initialize application:', error);
      this.handleError(error);
    }
  }

  /**
   * Cache DOM elements for better performance
   */
  cacheElements() {
    this.elements = {
      searchInput: document.getElementById('searchInput'),
      searchClear: document.getElementById('searchClear'),
      languageFilter: document.getElementById('languageFilter'),
      sortSelect: document.getElementById('sortSelect'),
      repositoryGrid: document.getElementById('repositoryGrid'),
      loadingState: document.getElementById('loadingState'),
      emptyState: document.getElementById('emptyState'),
      errorState: document.getElementById('errorState'),
      statsBar: document.getElementById('statsBar'),
      totalCount: document.getElementById('totalCount'),
      filteredCount: document.getElementById('filteredCount'),
      languageCount: document.getElementById('languageCount'),
      resetFilters: document.getElementById('resetFilters'),
      retryButton: document.getElementById('retryButton'),
      quickFilters: document.getElementById('quickFilters'),
      quickFilterButtons: document.getElementById('quickFilterButtons'),
      categorizationButtons: document.querySelectorAll('.categorization-btn'),
    };
  }

  /**
   * Bind event listeners
   */
  bindEvents() {
    // Search functionality
    this.elements.searchInput.addEventListener('input', (e) => {
      this.handleSearch(e.target.value);
    });

    this.elements.searchClear.addEventListener('click', () => {
      this.clearSearch();
    });

    // Filter functionality
    this.elements.languageFilter.addEventListener('change', (e) => {
      this.handleLanguageFilter(e.target.value);
    });

    // Sort functionality
    this.elements.sortSelect.addEventListener('change', (e) => {
      this.handleSort(e.target.value);
    });

    // Reset filters
    this.elements.resetFilters.addEventListener('click', () => {
      this.resetFilters();
    });

    // Retry button
    this.elements.retryButton.addEventListener('click', () => {
      this.retry();
    });

    // Categorization buttons
    this.elements.categorizationButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.handleCategorization(e.target.getAttribute('data-category'));
      });
    });

    // Keyboard shortcuts and navigation
    document.addEventListener('keydown', (e) => {
      this.handleKeyboardNavigation(e);
    });
  }

  /**
   * Load repository data from JSON file
   */
  async loadData() {
    try {
      this.setState({ isLoading: true, error: null });

      // Add timeout for better error handling
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch('data.json', {
        signal: controller.signal,
        cache: 'default' // Enable caching for better performance
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const repositories = this.processRepositoryData(data);
      const languages = this.extractLanguages(repositories);

      this.setState({
        repositories,
        filteredRepositories: repositories,
        languages,
        isLoading: false
      });

      this.populateLanguageFilter(languages);
      this.populateQuickFilters();

    } catch (error) {
      console.error('Error loading data:', error);
      let errorMessage = 'Failed to load repository data';

      if (error.name === 'AbortError') {
        errorMessage = 'Request timed out. Please check your connection and try again.';
      } else if (error.message.includes('HTTP error')) {
        errorMessage = 'Server error. Please try again later.';
      }

      this.setState({
        isLoading: false,
        error: errorMessage
      });
      throw error;
    }
  }

  /**
   * Process raw repository data into normalized format
   */
  processRepositoryData(data) {
    const repositories = [];
    let originalIndex = 0;
    const languageOrder = {}; // Track the order languages appear in data.json
    let languageOrderIndex = 0;

    // Handle both object format (grouped by language) and array format
    if (Array.isArray(data)) {
      repositories.push(...data);
    } else if (typeof data === 'object') {
      // Flatten repositories from language groups while preserving order
      Object.keys(data).forEach(language => {
        // Track language order for "Recently" categorization
        if (!languageOrder[language]) {
          languageOrder[language] = languageOrderIndex++;
        }

        const languageRepos = data[language];
        if (Array.isArray(languageRepos)) {
          repositories.push(...languageRepos);
        }
      });
    }

    // Store language order for later use
    this.languageOrder = languageOrder;

    // Normalize and validate repository data
    return repositories
      .filter(repo => repo && repo.id && repo.name)
      .map(repo => ({
        ...repo,
        // Ensure required fields have defaults
        description: repo.description || '',
        stargazers_count: repo.stargazers_count || 0,
        language: repo.language || 'Unknown',
        topics: Array.isArray(repo.topics) ? repo.topics : [],
        created_at: repo.created_at || new Date().toISOString(),
        updated_at: repo.updated_at || new Date().toISOString(),
        // Add computed fields
        originalIndex: originalIndex++, // Track original order for "Recent Likes" sorting
        searchText: this.createSearchText(repo),
        formattedStars: this.formatNumber(repo.stargazers_count || 0),
        relativeTime: this.getRelativeTime(repo.updated_at),
        languageColor: this.getLanguageColor(repo.language)
      }))
      .sort((a, b) => b.stargazers_count - a.stargazers_count); // Default sort by stars
  }

  /**
   * Create searchable text from repository data
   */
  createSearchText(repo) {
    return [
      repo.name,
      repo.full_name,
      repo.description,
      repo.language,
      ...(repo.topics || []),
      repo.owner?.login
    ].filter(Boolean).join(' ').toLowerCase();
  }

  /**
   * Extract unique languages from repositories
   */
  extractLanguages(repositories) {
    const languageSet = new Set();
    repositories.forEach(repo => {
      if (repo.language && repo.language !== 'Unknown') {
        languageSet.add(repo.language);
      }
    });
    return Array.from(languageSet).sort();
  }

  /**
   * Populate language filter dropdown with counts
   */
  populateLanguageFilter(languages) {
    const fragment = document.createDocumentFragment();

    // Calculate repository count for each language
    const languageCounts = this.calculateLanguageCounts();

    // Sort languages by count (descending) then alphabetically
    const sortedLanguages = languages.sort((a, b) => {
      const countA = languageCounts[a] || 0;
      const countB = languageCounts[b] || 0;

      if (countA !== countB) {
        return countB - countA; // Sort by count descending
      }
      return a.localeCompare(b); // Then alphabetically
    });

    sortedLanguages.forEach(language => {
      const option = document.createElement('option');
      option.value = language;
      const count = languageCounts[language] || 0;
      option.textContent = `${language} (${count})`;

      // Add data attribute for styling
      option.setAttribute('data-count', count);

      fragment.appendChild(option);
    });

    // Clear existing options except "All Languages"
    while (this.elements.languageFilter.children.length > 1) {
      this.elements.languageFilter.removeChild(this.elements.languageFilter.lastChild);
    }

    this.elements.languageFilter.appendChild(fragment);
  }

  /**
   * Calculate repository count for each language
   */
  calculateLanguageCounts() {
    const counts = {};

    this.state.repositories.forEach(repo => {
      const language = repo.language || 'Unknown';
      counts[language] = (counts[language] || 0) + 1;
    });

    return counts;
  }

  /**
   * Handle language filter change with analytics
   */
  handleLanguageFilter(language) {
    this.setState({ selectedLanguage: language });
    this.render();

    // Track filter usage
    if (language) {
      console.log('Language filter applied:', language);
    }
  }

  /**
   * Get languages for quick filters based on categorization mode
   */
  getLanguagesForQuickFilters(limit = 6) {
    const languageCounts = this.calculateLanguageCounts();
    const { languageCategory } = this.state;

    if (languageCategory === 'recently') {
      // Sort by the order languages appear in data.json
      return Object.keys(languageCounts)
        .sort((langA, langB) => {
          const orderA = this.languageOrder[langA] ?? 999;
          const orderB = this.languageOrder[langB] ?? 999;
          return orderA - orderB;
        })
        .slice(0, limit);
    } else {
      // Default: Sort by popularity (repository count)
      return Object.entries(languageCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, limit)
        .map(([language]) => language);
    }
  }



  /**
   * Populate quick filter buttons
   */
  populateQuickFilters() {
    const languages = this.getLanguagesForQuickFilters(6);
    const languageCounts = this.calculateLanguageCounts();
    const { languageCategory } = this.state;

    if (languages.length === 0) {
      this.elements.quickFilters.style.display = 'none';
      return;
    }

    // Update the label based on categorization mode
    const label = this.elements.quickFilters.querySelector('.quick-filters-label');
    if (label) {
      label.textContent = languageCategory === 'recently' ? 'Recently:' : 'Popular:';
    }

    const fragment = document.createDocumentFragment();

    languages.forEach(language => {
      const button = document.createElement('button');
      button.className = 'quick-filter-btn';
      button.setAttribute('data-language', language);
      button.innerHTML = `
        <span class="language-dot ${language.toLowerCase()}" style="background-color: ${this.getLanguageColor(language)}"></span>
        <span>${language}</span>
        <span class="quick-filter-count">${languageCounts[language] || 0}</span>
      `;

      button.addEventListener('click', () => {
        this.handleQuickFilter(language);
      });

      fragment.appendChild(button);
    });

    this.elements.quickFilterButtons.innerHTML = '';
    this.elements.quickFilterButtons.appendChild(fragment);
    this.elements.quickFilters.style.display = 'flex';
  }

  /**
   * Handle quick filter button click
   */
  handleQuickFilter(language) {
    // Update the main language filter
    this.elements.languageFilter.value = language;

    // Update active state of quick filter buttons
    this.elements.quickFilterButtons.querySelectorAll('.quick-filter-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-language') === language);
    });

    // Apply the filter
    this.handleLanguageFilter(language);
  }

  /**
   * Update application state
   */
  setState(newState) {
    this.state = { ...this.state, ...newState };

    // Update filtered repositories when relevant state changes
    if (newState.hasOwnProperty('repositories') ||
      newState.hasOwnProperty('searchTerm') ||
      newState.hasOwnProperty('selectedLanguage')) {
      this.updateFilteredRepositories();
    }

    // Sort repositories when sort criteria changes
    if (newState.hasOwnProperty('sortBy') || newState.hasOwnProperty('sortOrder')) {
      this.sortRepositories();
    }
  }

  /**
   * Update filtered repositories based on current filters
   */
  updateFilteredRepositories() {
    let filtered = [...this.state.repositories];

    // Apply search filter with advanced search
    if (this.state.searchTerm) {
      filtered = this.performAdvancedSearch(filtered, this.state.searchTerm);
    }

    // Apply language filter
    if (this.state.selectedLanguage) {
      filtered = filtered.filter(repo =>
        repo.language === this.state.selectedLanguage
      );
    }

    this.state.filteredRepositories = filtered;
    this.sortRepositories();
  }

  /**
   * Sort repositories based on current sort criteria
   */
  sortRepositories() {
    const { sortBy } = this.state;

    this.state.filteredRepositories.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'stars':
          comparison = b.stargazers_count - a.stargazers_count;
          break;
        case 'recent-likes':
          // Sort by original order in data.json (recent likes order)
          comparison = (a.originalIndex || 0) - (b.originalIndex || 0);
          break;
        case 'stars-asc':
          comparison = a.stargazers_count - b.stargazers_count;
          break;
        case 'name':
          comparison = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
          break;
        case 'name-desc':
          comparison = b.name.localeCompare(a.name, undefined, { sensitivity: 'base' });
          break;
        case 'updated':
          comparison = new Date(b.updated_at) - new Date(a.updated_at);
          break;
        case 'created':
          comparison = new Date(b.created_at) - new Date(a.created_at);
          break;
        default:
          // Default to stars descending
          comparison = b.stargazers_count - a.stargazers_count;
      }

      return comparison;
    });
  }

  /**
   * Handle sort change with enhanced logic
   */
  handleSort(sortBy) {
    this.setState({ sortBy });
    this.render();

    // Track sorting usage
    console.log('Sort applied:', sortBy);

    // Add visual feedback
    this.addSortFeedback(sortBy);
  }

  /**
   * Add visual feedback for sorting
   */
  addSortFeedback(sortBy) {
    const sortSelect = this.elements.sortSelect;
    sortSelect.classList.add('sorting');

    setTimeout(() => {
      sortSelect.classList.remove('sorting');
    }, 300);
  }

  /**
   * Get sort display name for UI
   */
  getSortDisplayName(sortBy) {
    const sortNames = {
      'stars': 'Most Stars',
      'stars-asc': 'Least Stars',
      'name': 'Name A-Z',
      'name-desc': 'Name Z-A',
      'updated': 'Recently Updated',
      'created': 'Recently Created'
    };

    return sortNames[sortBy] || 'Most Stars';
  }

  /**
   * Handle search input with advanced features
   */
  handleSearch(searchTerm) {
    // Clear existing debounce timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    // Update search clear button visibility
    this.elements.searchClear.classList.toggle('visible', searchTerm.length > 0);

    // Show immediate feedback for empty search
    if (searchTerm.trim() === '') {
      this.setState({ searchTerm: '' });
      this.render();
      return;
    }

    // Add loading indicator for search
    this.elements.searchInput.classList.add('searching');

    // Reduced debounce time for better responsiveness
    this.debounceTimer = setTimeout(() => {
      this.setState({ searchTerm: searchTerm.trim() });
      this.elements.searchInput.classList.remove('searching');
      this.render();

      // Track search analytics (if needed)
      this.trackSearch(searchTerm.trim());
    }, 200);
  }

  /**
   * Advanced search with multiple criteria
   */
  performAdvancedSearch(repositories, searchTerm) {
    if (!searchTerm) return repositories;

    const terms = searchTerm.toLowerCase().split(/\s+/).filter(term => term.length > 0);

    return repositories.filter(repo => {
      // Calculate relevance score
      let score = 0;
      const searchableText = repo.searchText;

      // Check if all terms are present
      const hasAllTerms = terms.every(term => searchableText.includes(term));
      if (!hasAllTerms) return false;

      // Boost score for exact matches in important fields
      terms.forEach(term => {
        if (repo.name.toLowerCase().includes(term)) score += 10;
        if (repo.description.toLowerCase().includes(term)) score += 5;
        if (repo.topics.some(topic => topic.toLowerCase().includes(term))) score += 8;
        if (repo.language.toLowerCase().includes(term)) score += 6;
        if (repo.owner.login.toLowerCase().includes(term)) score += 4;
      });

      // Store score for potential sorting
      repo.searchScore = score;
      return score > 0;
    }).sort((a, b) => (b.searchScore || 0) - (a.searchScore || 0));
  }

  /**
   * Track search for analytics (placeholder)
   */
  trackSearch(searchTerm) {
    // This could be used to track popular searches
    console.log('Search performed:', searchTerm);
  }

  /**
   * Clear search input and filters
   */
  clearSearch() {
    this.elements.searchInput.value = '';
    this.elements.searchClear.classList.remove('visible');
    this.setState({ searchTerm: '' });
    this.render();
  }

  /**
   * Handle language filter change
   */
  handleLanguageFilter(language) {
    this.setState({ selectedLanguage: language });
    this.render();
  }

  /**
   * Handle sort change
   */
  handleSort(sortBy) {
    this.setState({ sortBy });
    this.render();
  }

  /**
   * Reset all filters
   */
  resetFilters() {
    this.elements.searchInput.value = '';
    this.elements.searchClear.classList.remove('visible');
    this.elements.languageFilter.value = '';
    this.elements.sortSelect.value = 'recent-likes';

    // Reset quick filter buttons
    this.elements.quickFilterButtons.querySelectorAll('.quick-filter-btn').forEach(btn => {
      btn.classList.remove('active');
    });

    // Reset categorization to "Recently"
    this.elements.categorizationButtons.forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-category') === 'recently');
    });

    this.setState({
      searchTerm: '',
      selectedLanguage: '',
      sortBy: 'recent-likes',
      languageCategory: 'recently'
    });

    // Update quick filters to reflect the reset categorization
    this.populateQuickFilters();

    this.render();
  }

  /**
   * Retry loading data
   */
  async retry() {
    try {
      await this.loadData();
      this.render();
    } catch (error) {
      // Error is already handled in loadData
    }
  }

  /**
   * Handle categorization change
   */
  handleCategorization(category) {
    // Update active state of categorization buttons
    this.elements.categorizationButtons.forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-category') === category);
    });

    this.setState({ languageCategory: category });

    // Update quick filters to reflect the new categorization
    this.populateQuickFilters();

    this.render();

    // Track categorization usage
    console.log('Language categorization changed:', category);
  }

  /**
   * Handle application errors
   */
  handleError(error) {
    this.setState({
      error: error.message || 'An unexpected error occurred',
      isLoading: false
    });
    this.render();
  }

  /**
   * Render the application
   */
  render() {
    // Cancel any pending animation frame
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }

    // Use requestAnimationFrame for smooth rendering
    this.animationFrame = requestAnimationFrame(() => {
      this.updateUI();
    });
  }

  /**
   * Update the UI based on current state
   */
  updateUI() {
    const { isLoading, error, filteredRepositories, repositories, languages } = this.state;

    // Update statistics
    this.updateStatistics();

    // Show/hide different states
    this.elements.loadingState.style.display = isLoading ? 'flex' : 'none';
    this.elements.errorState.style.display = error ? 'flex' : 'none';
    this.elements.emptyState.style.display =
      !isLoading && !error && filteredRepositories.length === 0 ? 'flex' : 'none';
    this.elements.repositoryGrid.style.display =
      !isLoading && !error && filteredRepositories.length > 0 ? 'grid' : 'none';
    this.elements.statsBar.style.display =
      !isLoading && !error ? 'block' : 'none';

    // Show skeleton loading or render repositories
    if (isLoading) {
      this.renderSkeletonCards();
    } else if (!error && filteredRepositories.length > 0) {
      this.renderRepositories();
    }
  }

  /**
   * Render skeleton loading cards
   */
  renderSkeletonCards() {
    this.elements.repositoryGrid.innerHTML = '';
    this.elements.repositoryGrid.className = 'repository-grid skeleton-grid';
    this.elements.repositoryGrid.style.display = 'grid';

    const skeletonCards = this.createSkeletonCards(9);
    this.elements.repositoryGrid.appendChild(skeletonCards);
  }

  /**
   * Update statistics display
   */
  updateStatistics() {
    const { repositories, filteredRepositories, languages } = this.state;

    this.elements.totalCount.textContent = this.formatNumber(repositories.length);
    this.elements.filteredCount.textContent = this.formatNumber(filteredRepositories.length);
    this.elements.languageCount.textContent = languages.length;
  }

  /**
   * Format numbers for display (e.g., 1000 -> 1K)
   */
  formatNumber(num) {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  }

  /**
   * Get relative time string (e.g., "2 days ago")
   */
  getRelativeTime(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);

    const intervals = [
      { label: 'year', seconds: 31536000 },
      { label: 'month', seconds: 2592000 },
      { label: 'day', seconds: 86400 },
      { label: 'hour', seconds: 3600 },
      { label: 'minute', seconds: 60 }
    ];

    for (const interval of intervals) {
      const count = Math.floor(diffInSeconds / interval.seconds);
      if (count >= 1) {
        return `${count} ${interval.label}${count > 1 ? 's' : ''} ago`;
      }
    }

    return 'Just now';
  }

  /**
   * Get language color for styling
   */
  getLanguageColor(language) {
    const colors = {
      'TypeScript': '#3178c6',
      'JavaScript': '#f1e05a',
      'Python': '#3572a5',
      'Java': '#b07219',
      'HTML': '#e34c26',
      'CSS': '#563d7c',
      'SCSS': '#c6538c',
      'Vue': '#4fc08d',
      'Go': '#00add8',
      'Rust': '#dea584',
      'PHP': '#4f5d95',
      'Ruby': '#701516',
      'Swift': '#fa7343',
      'Kotlin': '#a97bff',
      'Dart': '#00b4ab',
      'Shell': '#89e051',
      'Dockerfile': '#384d54'
    };

    return colors[language] || '#64748b';
  }

  /**
   * Render repositories in the grid
   */
  renderRepositories() {
    const { filteredRepositories } = this.state;

    // Performance optimization: use requestAnimationFrame for smooth rendering
    requestAnimationFrame(() => {
      const fragment = document.createDocumentFragment();

      // Group repositories by language for better organization
      const groupedRepos = this.groupRepositoriesByLanguage(filteredRepositories);

      // Render each language section
      Object.entries(groupedRepos).forEach(([language, repos]) => {
        // Create language section header
        const languageSection = this.createLanguageSection(language, repos.length);
        fragment.appendChild(languageSection);

        // Create repository cards with staggered animation
        repos.forEach((repo, index) => {
          const card = this.createRepositoryCard(repo, index);
          fragment.appendChild(card);
        });
      });

      // Clear existing content and append new content
      this.elements.repositoryGrid.innerHTML = '';
      this.elements.repositoryGrid.appendChild(fragment);

      // Trigger entrance animations
      this.triggerCardAnimations();
    });
  }

  /**
   * Group repositories by programming language
   */
  groupRepositoriesByLanguage(repositories) {
    const grouped = {};

    repositories.forEach(repo => {
      const language = repo.language || 'Other';
      if (!grouped[language]) {
        grouped[language] = [];
      }
      grouped[language].push(repo);
    });

    // Sort languages based on categorization mode
    const { languageCategory } = this.state;
    let sortedEntries;

    if (languageCategory === 'recently') {
      // Sort by the order languages appear in data.json
      sortedEntries = Object.entries(grouped)
        .sort(([langA], [langB]) => {
          const orderA = this.languageOrder[langA] ?? 999;
          const orderB = this.languageOrder[langB] ?? 999;
          return orderA - orderB;
        });
    } else {
      // Default: Sort by repository count (descending) - Popular
      sortedEntries = Object.entries(grouped)
        .sort(([, a], [, b]) => b.length - a.length);
    }

    return Object.fromEntries(sortedEntries);
  }

  /**
   * Create language section header
   */
  createLanguageSection(language, count) {
    const section = document.createElement('div');
    section.className = 'language-section';

    section.innerHTML = `
      <div class="language-header">
        <h2 class="language-title">
          <span class="language-dot ${language.toLowerCase()}" style="background-color: ${this.getLanguageColor(language)}"></span>
          ${language}
        </h2>
        <span class="language-count">${count} ${count === 1 ? 'repository' : 'repositories'}</span>
      </div>
    `;

    return section;
  }

  /**
   * Create a repository card element
   */
  createRepositoryCard(repo, index = 0) {
    const card = document.createElement('article');
    card.className = 'repo-card';
    card.style.animationDelay = `${Math.min(index * 100, 600)}ms`;

    // Create card content
    card.innerHTML = `
      <div class="repo-header">
        <div class="repo-title">
          <a href="${repo.html_url}" target="_blank" rel="noopener noreferrer" class="repo-name">
            ${this.escapeHtml(repo.name)}
          </a>
          <div class="repo-full-name">${this.escapeHtml(repo.full_name)}</div>
        </div>
        <div class="repo-stars">
          <span class="star-icon">⭐</span>
          <span class="star-count">${repo.formattedStars}</span>
        </div>
      </div>
      
      ${repo.description ? `<p class="repo-description">${this.escapeHtml(repo.description)}</p>` : ''}
      
      <div class="repo-topics">
        ${repo.topics.slice(0, 6).map(topic =>
      `<a href="https://github.com/topics/${encodeURIComponent(topic)}" 
             target="_blank" 
             rel="noopener noreferrer" 
             class="topic-tag">${this.escapeHtml(topic)}</a>`
    ).join('')}
        ${repo.topics.length > 6 ? `<span class="topic-tag">+${repo.topics.length - 6} more</span>` : ''}
      </div>
      
      ${repo.homepage ? `
        <a href="${repo.homepage}" target="_blank" rel="noopener noreferrer" class="repo-homepage">
          <svg class="homepage-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
            <polyline points="15,3 21,3 21,9"></polyline>
            <line x1="10" y1="14" x2="21" y2="3"></line>
          </svg>
          Visit Website
        </a>
      ` : ''}
      
      <div class="repo-footer">
        <a href="${repo.owner.html_url}" target="_blank" rel="noopener noreferrer" class="repo-owner">
          <img src="${repo.owner.avatar_url}" alt="${this.escapeHtml(repo.owner.login)}" class="owner-avatar" loading="lazy" decoding="async">
          <span class="owner-name">${this.escapeHtml(repo.owner.login)}</span>
        </a>
        
        <div class="repo-meta">
          <div class="repo-language">
            <span class="language-dot ${repo.language.toLowerCase()}" style="background-color: ${repo.languageColor}"></span>
            <span>${this.escapeHtml(repo.language)}</span>
          </div>
          <div class="repo-updated" title="Last updated: ${new Date(repo.updated_at).toLocaleDateString()}">
            ${repo.relativeTime}
          </div>
        </div>
      </div>
    `;

    // Add click handler for external links
    this.addCardEventListeners(card, repo);

    return card;
  }

  /**
   * Add event listeners to repository card
   */
  addCardEventListeners(card, repo) {
    // Handle keyboard navigation
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        window.open(repo.html_url, '_blank', 'noopener,noreferrer');
      }
    });

    // Add focus capability for accessibility
    card.setAttribute('tabindex', '0');
    card.setAttribute('role', 'article');
    card.setAttribute('aria-label', `Repository: ${repo.name} by ${repo.owner.login}. ${repo.stargazers_count} stars. Language: ${repo.language}`);

    // Prevent event bubbling on interactive elements
    const interactiveElements = card.querySelectorAll('a, button');
    interactiveElements.forEach(element => {
      element.addEventListener('click', (e) => {
        e.stopPropagation();
      });
    });
  }

  /**
   * Trigger staggered entrance animations for cards
   */
  triggerCardAnimations() {
    const cards = this.elements.repositoryGrid.querySelectorAll('.repo-card');

    // Reset animations
    cards.forEach(card => {
      card.style.animation = 'none';
      card.offsetHeight; // Trigger reflow
      card.style.animation = null;
    });

    // Observe cards for intersection-based animations
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('animate-in');
            observer.unobserve(entry.target);
          }
        });
      }, {
        threshold: 0.1,
        rootMargin: '50px'
      });

      cards.forEach(card => {
        observer.observe(card);
      });
    }
  }

  /**
   * Escape HTML to prevent XSS attacks
   */
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Create loading skeleton cards
   */
  createSkeletonCards(count = 6) {
    const fragment = document.createDocumentFragment();

    for (let i = 0; i < count; i++) {
      const card = document.createElement('div');
      card.className = 'repo-card skeleton';
      card.innerHTML = `
        <div class="repo-header">
          <div class="repo-title">
            <div class="repo-name">Loading repository name...</div>
            <div class="repo-full-name">owner/repository-name</div>
          </div>
          <div class="repo-stars">
            <span class="star-icon">⭐</span>
            <span class="star-count">1.2K</span>
          </div>
        </div>
        
        <p class="repo-description">Loading repository description that might be quite long and span multiple lines...</p>
        
        <div class="repo-topics">
          <span class="topic-tag">loading</span>
          <span class="topic-tag">skeleton</span>
          <span class="topic-tag">placeholder</span>
        </div>
        
        <div class="repo-footer">
          <div class="repo-owner">
            <div class="owner-avatar"></div>
            <span class="owner-name">username</span>
          </div>
          
          <div class="repo-meta">
            <div class="repo-language">
              <span class="language-dot"></span>
              <span>Language</span>
            </div>
            <div class="repo-updated">2 days ago</div>
          </div>
        </div>
      `;

      fragment.appendChild(card);
    }

    return fragment;
  }
  /**
   * Initialize animations and UI enhancements
   */
  initializeAnimations() {
    // Add page transition
    document.body.classList.add('page-transition');

    // Add interactive feedback to buttons
    this.addInteractiveFeedback();

    // Initialize loading progress bar
    this.createLoadingProgressBar();

    // Add parallax effect to header
    this.initializeParallax();

    // Initialize responsive behavior
    this.initializeResponsiveBehavior();

    // Initialize touch interactions
    this.initializeTouchInteractions();

    // Trigger page loaded animation
    setTimeout(() => {
      document.body.classList.add('loaded');
    }, 100);
  }

  /**
   * Add interactive feedback to clickable elements
   */
  addInteractiveFeedback() {
    const interactiveElements = document.querySelectorAll(
      'button, .filter-select, .search-input, .quick-filter-btn'
    );

    interactiveElements.forEach(element => {
      element.classList.add('interactive-feedback');

      // Add micro-bounce effect
      if (element.tagName === 'BUTTON') {
        element.classList.add('micro-bounce', 'btn-press');
      }
    });
  }

  /**
   * Create loading progress bar
   */
  createLoadingProgressBar() {
    const progressBar = document.createElement('div');
    progressBar.className = 'loading-progress';
    progressBar.id = 'loadingProgress';
    progressBar.innerHTML = '<div class="loading-progress-bar" id="loadingProgressBar"></div>';

    document.body.appendChild(progressBar);
    this.elements.loadingProgress = progressBar;
    this.elements.loadingProgressBar = progressBar.querySelector('.loading-progress-bar');
  }

  /**
   * Show/hide loading progress
   */
  updateLoadingProgress(progress = 0, visible = false) {
    if (!this.elements.loadingProgress) return;

    this.elements.loadingProgress.classList.toggle('visible', visible);
    this.elements.loadingProgressBar.style.width = `${Math.min(100, Math.max(0, progress))}%`;
  }

  /**
   * Initialize parallax effects
   */
  initializeParallax() {
    const header = document.querySelector('.header');
    if (!header) return;

    const parallaxElement = document.createElement('div');
    parallaxElement.className = 'header-parallax';
    header.appendChild(parallaxElement);

    // Add scroll-based parallax
    let ticking = false;

    const updateParallax = () => {
      const scrolled = window.pageYOffset;
      const rate = scrolled * -0.5;

      parallaxElement.style.transform = `translateY(${rate}px)`;
      ticking = false;
    };

    const requestParallaxUpdate = () => {
      if (!ticking) {
        requestAnimationFrame(updateParallax);
        ticking = true;
      }
    };

    window.addEventListener('scroll', requestParallaxUpdate, { passive: true });
  }

  /**
   * Initialize scroll-based animations
   */
  initializeScrollAnimations() {
    if (!('IntersectionObserver' in window)) return;

    const observerOptions = {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          observer.unobserve(entry.target);
        }
      });
    }, observerOptions);

    // Observe elements that should animate on scroll
    const animateElements = document.querySelectorAll('.stats-bar, .footer');
    animateElements.forEach(el => {
      el.classList.add('scroll-reveal');
      observer.observe(el);
    });
  }

  /**
   * Show toast notification
   */
  showToast(message, type = 'info', duration = 3000) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;

    document.body.appendChild(toast);

    // Trigger animation
    setTimeout(() => toast.classList.add('visible'), 100);

    // Auto remove
    setTimeout(() => {
      toast.classList.remove('visible');
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, duration);
  }

  /**
   * Add smooth filtering animation
   */
  animateFiltering() {
    this.elements.repositoryGrid.classList.add('updating');

    setTimeout(() => {
      this.elements.repositoryGrid.classList.remove('updating');
      this.elements.repositoryGrid.classList.add('updated');

      setTimeout(() => {
        this.elements.repositoryGrid.classList.remove('updated');
      }, 500);
    }, 200);
  }

  /**
   * Animate statistics update
   */
  animateStatsUpdate() {
    const statsValues = document.querySelectorAll('.stats-value');

    statsValues.forEach(stat => {
      stat.classList.add('updating');
      setTimeout(() => {
        stat.classList.remove('updating');
      }, 400);
    });
  }

  /**
   * Enhanced render with animations
   */
  render() {
    // Cancel any pending animation frame
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }

    // Add filtering animation
    if (!this.state.isLoading) {
      this.animateFiltering();
    }

    // Use requestAnimationFrame for smooth rendering
    this.animationFrame = requestAnimationFrame(() => {
      this.updateUI();
      this.animateStatsUpdate();
    });
  }

  /**
   * Enhanced data loading with progress
   */
  async loadData() {
    try {
      this.setState({ isLoading: true, error: null });
      this.updateLoadingProgress(10, true);

      const response = await fetch('data.json');
      this.updateLoadingProgress(30, true);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      this.updateLoadingProgress(60, true);

      const repositories = this.processRepositoryData(data);
      this.updateLoadingProgress(80, true);

      const languages = this.extractLanguages(repositories);
      this.updateLoadingProgress(90, true);

      this.setState({
        repositories,
        filteredRepositories: repositories,
        languages,
        isLoading: false
      });

      this.populateLanguageFilter(languages);
      this.populateQuickFilters();

      this.updateLoadingProgress(100, true);

      // Hide progress bar after completion
      setTimeout(() => {
        this.updateLoadingProgress(0, false);
      }, 500);

      // Show success toast
      this.showToast(`Loaded ${repositories.length} repositories successfully!`, 'success');

    } catch (error) {
      console.error('Error loading data:', error);
      this.updateLoadingProgress(0, false);
      this.setState({
        isLoading: false,
        error: error.message || 'Failed to load repository data'
      });

      // Show error toast
      this.showToast('Failed to load repository data', 'error');
      throw error;
    }
  }

  /**
   * Enhanced search with visual feedback
   */
  handleSearch(searchTerm) {
    // Clear existing debounce timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    // Update search clear button visibility
    this.elements.searchClear.classList.toggle('visible', searchTerm.length > 0);

    // Show immediate feedback for empty search
    if (searchTerm.trim() === '') {
      this.setState({ searchTerm: '' });
      this.render();
      return;
    }

    // Add loading indicator for search
    this.elements.searchInput.classList.add('searching');

    // Debounce search to avoid excessive filtering
    this.debounceTimer = setTimeout(() => {
      this.setState({ searchTerm: searchTerm.trim() });
      this.elements.searchInput.classList.remove('searching');
      this.render();

      // Show search results toast
      const resultCount = this.state.filteredRepositories.length;
      if (searchTerm.trim()) {
        this.showToast(`Found ${resultCount} repositories matching "${searchTerm.trim()}"`, 'info', 2000);
      }

      // Track search analytics (if needed)
      this.trackSearch(searchTerm.trim());
    }, 300);
  }

  /**
   * Enhanced quick filter with animation
   */
  handleQuickFilter(language) {
    // Update the main language filter
    this.elements.languageFilter.value = language;

    // Update active state of quick filter buttons with animation
    this.elements.quickFilterButtons.querySelectorAll('.quick-filter-btn').forEach(btn => {
      const isActive = btn.getAttribute('data-language') === language;
      btn.classList.toggle('active', isActive);

      if (isActive) {
        // Trigger active animation
        btn.style.animation = 'none';
        btn.offsetHeight; // Trigger reflow
        btn.style.animation = 'activeFilter 0.3s ease-out';
      }
    });

    // Apply the filter
    this.handleLanguageFilter(language);

    // Show filter toast
    const count = this.calculateLanguageCounts()[language] || 0;
    this.showToast(`Showing ${count} ${language} repositories`, 'info', 2000);
  }

  /**
   * Initialize responsive behavior
   */
  initializeResponsiveBehavior() {
    // Handle viewport changes
    let resizeTimer;
    const handleResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        this.handleViewportChange();
      }, 250);
    };

    window.addEventListener('resize', handleResize, { passive: true });

    // Handle orientation changes
    window.addEventListener('orientationchange', () => {
      setTimeout(() => {
        this.handleViewportChange();
      }, 500);
    });

    // Initial viewport setup
    this.handleViewportChange();

    // Handle visibility changes (tab switching)
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        this.handleVisibilityChange();
      }
    });
  }

  /**
   * Handle viewport changes
   */
  handleViewportChange() {
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight,
      isMobile: window.innerWidth <= 768,
      isTablet: window.innerWidth > 768 && window.innerWidth <= 1024,
      isDesktop: window.innerWidth > 1024
    };

    // Update CSS custom properties based on viewport
    document.documentElement.style.setProperty('--viewport-width', `${viewport.width}px`);
    document.documentElement.style.setProperty('--viewport-height', `${viewport.height}px`);

    // Adjust grid columns based on viewport
    this.adjustGridLayout(viewport);

    // Update search input behavior for mobile
    this.updateSearchBehavior(viewport);

    // Store viewport info
    this.viewport = viewport;
  }

  /**
   * Adjust grid layout based on viewport
   */
  adjustGridLayout(viewport) {
    const grid = this.elements.repositoryGrid;
    if (!grid) return;

    let columns;
    if (viewport.isMobile) {
      columns = '1fr';
    } else if (viewport.isTablet) {
      columns = 'repeat(2, 1fr)';
    } else {
      columns = 'repeat(auto-fill, minmax(350px, 1fr))';
    }

    grid.style.gridTemplateColumns = columns;
  }

  /**
   * Update search behavior for mobile
   */
  updateSearchBehavior(viewport) {
    const searchInput = this.elements.searchInput;
    if (!searchInput) return;

    if (viewport.isMobile) {
      // Prevent zoom on iOS
      searchInput.style.fontSize = '16px';

      // Add mobile-specific attributes
      searchInput.setAttribute('autocapitalize', 'none');
      searchInput.setAttribute('autocorrect', 'off');
      searchInput.setAttribute('spellcheck', 'false');
    } else {
      searchInput.style.fontSize = '';
    }
  }

  /**
   * Handle visibility changes (tab switching)
   */
  handleVisibilityChange() {
    // Refresh data if page was hidden for more than 5 minutes
    const now = Date.now();
    const lastUpdate = this.lastVisibilityChange || now;
    const timeDiff = now - lastUpdate;

    if (timeDiff > 5 * 60 * 1000) { // 5 minutes
      this.showToast('Refreshing data...', 'info', 1000);
      // Could refresh data here if needed
    }

    this.lastVisibilityChange = now;
  }

  /**
   * Initialize touch interactions
   */
  initializeTouchInteractions() {
    // Add touch feedback to repository cards
    this.addTouchFeedback();

    // Handle swipe gestures
    this.initializeSwipeGestures();

    // Optimize scroll performance
    this.optimizeScrollPerformance();
  }

  /**
   * Add touch feedback to interactive elements
   */
  addTouchFeedback() {
    const cards = document.querySelectorAll('.repo-card');

    cards.forEach(card => {
      let touchStartTime;
      let touchStartY;

      card.addEventListener('touchstart', (e) => {
        touchStartTime = Date.now();
        touchStartY = e.touches[0].clientY;
        card.classList.add('touching');
      }, { passive: true });

      card.addEventListener('touchend', (e) => {
        const touchEndTime = Date.now();
        const touchDuration = touchEndTime - touchStartTime;

        card.classList.remove('touching');

        // Handle tap (short touch)
        if (touchDuration < 200) {
          this.handleCardTap(card, e);
        }
      }, { passive: true });

      card.addEventListener('touchcancel', () => {
        card.classList.remove('touching');
      }, { passive: true });
    });
  }

  /**
   * Handle card tap on mobile
   */
  handleCardTap(card, event) {
    // Find the repository URL
    const repoLink = card.querySelector('.repo-name');
    if (repoLink) {
      // Add visual feedback
      card.style.transform = 'scale(0.98)';
      setTimeout(() => {
        card.style.transform = '';
      }, 150);

      // Open link after animation
      setTimeout(() => {
        window.open(repoLink.href, '_blank', 'noopener,noreferrer');
      }, 100);
    }
  }

  /**
   * Initialize swipe gestures
   */
  initializeSwipeGestures() {
    let startX, startY, startTime;

    document.addEventListener('touchstart', (e) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      startTime = Date.now();
    }, { passive: true });

    document.addEventListener('touchend', (e) => {
      if (!startX || !startY) return;

      const endX = e.changedTouches[0].clientX;
      const endY = e.changedTouches[0].clientY;
      const endTime = Date.now();

      const deltaX = endX - startX;
      const deltaY = endY - startY;
      const deltaTime = endTime - startTime;

      // Check for swipe gesture
      if (Math.abs(deltaX) > 50 && Math.abs(deltaY) < 100 && deltaTime < 300) {
        if (deltaX > 0) {
          // Swipe right - could implement navigation
          this.handleSwipeRight();
        } else {
          // Swipe left - could implement navigation
          this.handleSwipeLeft();
        }
      }

      startX = startY = null;
    }, { passive: true });
  }

  /**
   * Handle swipe right gesture
   */
  handleSwipeRight() {
    // Could implement previous page or reset filters
    console.log('Swipe right detected');
  }

  /**
   * Handle swipe left gesture
   */
  handleSwipeLeft() {
    // Could implement next page or additional filters
    console.log('Swipe left detected');
  }

  /**
   * Optimize scroll performance
   */
  optimizeScrollPerformance() {
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          this.updateScrollPosition();
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
  }

  /**
   * Update scroll position for effects
   */
  updateScrollPosition() {
    const scrollY = window.pageYOffset;

    // Update header parallax
    const header = document.querySelector('.header-parallax');
    if (header) {
      header.style.transform = `translateY(${scrollY * 0.5}px)`;
    }

    // Show/hide scroll-to-top button (if implemented)
    this.updateScrollToTop(scrollY);
  }

  /**
   * Update scroll-to-top button visibility
   */
  updateScrollToTop(scrollY) {
    // Could implement scroll-to-top button
    if (scrollY > 500) {
      // Show button
    } else {
      // Hide button
    }
  }

  /**
   * Check if device supports hover
   */
  supportsHover() {
    return window.matchMedia('(hover: hover)').matches;
  }

  /**
   * Check if device is touch-enabled
   */
  isTouchDevice() {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }

  /**
   * Get device type
   */
  getDeviceType() {
    const width = window.innerWidth;

    if (width <= 480) return 'mobile-small';
    if (width <= 768) return 'mobile';
    if (width <= 1024) return 'tablet';
    return 'desktop';
  }

  /**
   * Handle keyboard navigation
   */
  handleKeyboardNavigation(e) {
    // Global keyboard shortcuts
    if (e.ctrlKey || e.metaKey) {
      switch (e.key) {
        case 'k':
          e.preventDefault();
          this.focusSearch();
          break;
        case 'l':
          e.preventDefault();
          this.focusLanguageFilter();
          break;
        case 'r':
          e.preventDefault();
          this.resetFilters();
          break;
      }
    }

    // Escape key handling
    if (e.key === 'Escape') {
      this.handleEscapeKey();
    }

    // Arrow key navigation for repository cards
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      this.handleArrowNavigation(e);
    }

    // Tab navigation enhancements
    if (e.key === 'Tab') {
      this.handleTabNavigation(e);
    }

    // Enter/Space for activation
    if (e.key === 'Enter' || e.key === ' ') {
      this.handleActivation(e);
    }
  }

  /**
   * Focus search input with accessibility announcement
   */
  focusSearch() {
    this.elements.searchInput.focus();
    this.announceToScreenReader('Search input focused. Type to search repositories.');
  }

  /**
   * Focus language filter
   */
  focusLanguageFilter() {
    this.elements.languageFilter.focus();
    this.announceToScreenReader('Language filter focused. Use arrow keys to select a language.');
  }

  /**
   * Handle escape key
   */
  handleEscapeKey() {
    // Clear search if search input is focused
    if (document.activeElement === this.elements.searchInput) {
      this.clearSearch();
      return;
    }

    // Reset filters if any are active
    if (this.state.searchTerm || this.state.selectedLanguage) {
      this.resetFilters();
      this.announceToScreenReader('All filters cleared.');
      return;
    }

    // Remove focus from current element
    if (document.activeElement && document.activeElement !== document.body) {
      document.activeElement.blur();
    }
  }

  /**
   * Handle arrow key navigation for repository cards
   */
  handleArrowNavigation(e) {
    const cards = Array.from(document.querySelectorAll('.repo-card'));
    const currentIndex = cards.indexOf(document.activeElement);

    if (currentIndex === -1) return;

    let nextIndex;
    const columns = this.getGridColumns();

    switch (e.key) {
      case 'ArrowUp':
        nextIndex = Math.max(0, currentIndex - columns);
        break;
      case 'ArrowDown':
        nextIndex = Math.min(cards.length - 1, currentIndex + columns);
        break;
      case 'ArrowLeft':
        nextIndex = Math.max(0, currentIndex - 1);
        break;
      case 'ArrowRight':
        nextIndex = Math.min(cards.length - 1, currentIndex + 1);
        break;
    }

    if (nextIndex !== undefined && cards[nextIndex]) {
      e.preventDefault();
      cards[nextIndex].focus();
      this.scrollIntoViewIfNeeded(cards[nextIndex]);
    }
  }

  /**
   * Get current grid columns for navigation
   */
  getGridColumns() {
    const width = window.innerWidth;
    if (width <= 768) return 1;
    if (width <= 1024) return 2;
    return 3;
  }

  /**
   * Handle tab navigation enhancements
   */
  handleTabNavigation(e) {
    // Skip hidden elements
    const focusableElements = this.getFocusableElements();
    const currentIndex = focusableElements.indexOf(document.activeElement);

    if (currentIndex === -1) return;

    // Implement custom tab order if needed
    this.updateTabOrder();
  }

  /**
   * Get all focusable elements
   */
  getFocusableElements() {
    const selector = [
      'input:not([disabled])',
      'select:not([disabled])',
      'button:not([disabled])',
      'a[href]',
      '[tabindex]:not([tabindex="-1"])',
      '.repo-card'
    ].join(', ');

    return Array.from(document.querySelectorAll(selector))
      .filter(el => this.isElementVisible(el));
  }

  /**
   * Check if element is visible
   */
  isElementVisible(element) {
    const style = window.getComputedStyle(element);
    return style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      element.offsetParent !== null;
  }

  /**
   * Update tab order for better navigation
   */
  updateTabOrder() {
    // Ensure logical tab order
    const searchInput = this.elements.searchInput;
    const languageFilter = this.elements.languageFilter;
    const sortSelect = this.elements.sortSelect;
    const quickFilters = this.elements.quickFilterButtons.querySelectorAll('.quick-filter-btn');
    const cards = document.querySelectorAll('.repo-card');

    let tabIndex = 1;

    // Set tab order
    if (searchInput) searchInput.tabIndex = tabIndex++;
    if (languageFilter) languageFilter.tabIndex = tabIndex++;
    if (sortSelect) sortSelect.tabIndex = tabIndex++;

    quickFilters.forEach(btn => {
      btn.tabIndex = tabIndex++;
    });

    cards.forEach(card => {
      card.tabIndex = tabIndex++;
    });
  }

  /**
   * Handle activation (Enter/Space)
   */
  handleActivation(e) {
    const target = e.target;

    // Handle repository card activation
    if (target.classList.contains('repo-card')) {
      e.preventDefault();
      const repoLink = target.querySelector('.repo-name');
      if (repoLink) {
        window.open(repoLink.href, '_blank', 'noopener,noreferrer');
        this.announceToScreenReader(`Opening ${repoLink.textContent} repository in new tab.`);
      }
    }

    // Handle quick filter activation
    if (target.classList.contains('quick-filter-btn')) {
      e.preventDefault();
      const language = target.getAttribute('data-language');
      this.handleQuickFilter(language);
    }
  }

  /**
   * Scroll element into view if needed
   */
  scrollIntoViewIfNeeded(element) {
    const rect = element.getBoundingClientRect();
    const isVisible = rect.top >= 0 &&
      rect.bottom <= window.innerHeight &&
      rect.left >= 0 &&
      rect.right <= window.innerWidth;

    if (!isVisible) {
      element.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'nearest'
      });
    }
  }

  /**
   * Announce to screen reader
   */
  announceToScreenReader(message) {
    const announcement = document.createElement('div');
    announcement.setAttribute('aria-live', 'polite');
    announcement.setAttribute('aria-atomic', 'true');
    announcement.className = 'sr-only';
    announcement.textContent = message;

    document.body.appendChild(announcement);

    // Remove after announcement
    setTimeout(() => {
      if (announcement.parentNode) {
        announcement.parentNode.removeChild(announcement);
      }
    }, 1000);
  }

  /**
   * Update ARIA labels and descriptions
   */
  updateAriaLabels() {
    // Update search input
    const searchInput = this.elements.searchInput;
    if (searchInput) {
      searchInput.setAttribute('aria-label', 'Search repositories by name, description, or topics');
      searchInput.setAttribute('aria-describedby', 'search-help');
    }

    // Update language filter
    const languageFilter = this.elements.languageFilter;
    if (languageFilter) {
      languageFilter.setAttribute('aria-label', 'Filter repositories by programming language');
    }

    // Update sort select
    const sortSelect = this.elements.sortSelect;
    if (sortSelect) {
      sortSelect.setAttribute('aria-label', 'Sort repositories by different criteria');
    }

    // Update repository cards
    this.updateRepositoryCardAria();

    // Update statistics
    this.updateStatisticsAria();
  }

  /**
   * Update repository card ARIA attributes
   */
  updateRepositoryCardAria() {
    const cards = document.querySelectorAll('.repo-card');

    cards.forEach(card => {
      const repoName = card.querySelector('.repo-name');
      const ownerName = card.querySelector('.owner-name');
      const stars = card.querySelector('.star-count');
      const language = card.querySelector('.repo-language span:last-child');

      if (repoName && ownerName) {
        const ariaLabel = `Repository: ${repoName.textContent} by ${ownerName.textContent}`;
        const ariaDescription = [];

        if (stars) ariaDescription.push(`${stars.textContent} stars`);
        if (language) ariaDescription.push(`Written in ${language.textContent}`);

        card.setAttribute('aria-label', ariaLabel);
        if (ariaDescription.length > 0) {
          card.setAttribute('aria-description', ariaDescription.join(', '));
        }
      }
    });
  }

  /**
   * Update statistics ARIA attributes
   */
  updateStatisticsAria() {
    const totalCount = this.elements.totalCount;
    const filteredCount = this.elements.filteredCount;
    const languageCount = this.elements.languageCount;

    if (totalCount) {
      totalCount.setAttribute('aria-label', `Total repositories: ${totalCount.textContent}`);
    }

    if (filteredCount) {
      filteredCount.setAttribute('aria-label', `Currently showing: ${filteredCount.textContent} repositories`);
    }

    if (languageCount) {
      languageCount.setAttribute('aria-label', `Available languages: ${languageCount.textContent}`);
    }
  }

  /**
   * Initialize accessibility features
   */
  initializeAccessibility() {
    // Add skip links
    this.addSkipLinks();

    // Update ARIA labels
    this.updateAriaLabels();

    // Add keyboard navigation help
    this.addKeyboardHelp();

    // Set up focus management
    this.setupFocusManagement();

    // Add live regions for dynamic content
    this.setupLiveRegions();
  }

  /**
   * Add skip links for keyboard navigation
   */
  addSkipLinks() {
    const skipLinks = document.createElement('div');
    skipLinks.className = 'skip-links';
    skipLinks.innerHTML = `
      <a href="#searchInput" class="skip-link">Skip to search</a>
      <a href="#repositoryGrid" class="skip-link">Skip to repositories</a>
      <a href="#footer" class="skip-link">Skip to footer</a>
    `;

    document.body.insertBefore(skipLinks, document.body.firstChild);
  }

  /**
   * Add keyboard navigation help
   */
  addKeyboardHelp() {
    const helpText = document.createElement('div');
    helpText.id = 'search-help';
    helpText.className = 'sr-only';
    helpText.textContent = 'Use Ctrl+K to focus search, Ctrl+F for language filter, Ctrl+R to reset filters, Escape to clear search or filters.';

    document.body.appendChild(helpText);
  }

  /**
   * Setup focus management
   */
  setupFocusManagement() {
    // Trap focus in modals (if any)
    // Manage focus on dynamic content updates

    // Focus first repository card when grid updates
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList' && mutation.target === this.elements.repositoryGrid) {
          const firstCard = this.elements.repositoryGrid.querySelector('.repo-card');
          if (firstCard && document.activeElement === document.body) {
            // Only focus if no other element has focus
            setTimeout(() => {
              if (document.activeElement === document.body) {
                // firstCard.focus();
              }
            }, 100);
          }
        }
      });
    });

    if (this.elements.repositoryGrid) {
      observer.observe(this.elements.repositoryGrid, { childList: true });
    }
  }

  /**
   * Setup live regions for dynamic announcements
   */
  setupLiveRegions() {
    // Create live region for search results
    const searchLiveRegion = document.createElement('div');
    searchLiveRegion.id = 'search-live-region';
    searchLiveRegion.setAttribute('aria-live', 'polite');
    searchLiveRegion.setAttribute('aria-atomic', 'true');
    searchLiveRegion.className = 'sr-only';

    document.body.appendChild(searchLiveRegion);
    this.elements.searchLiveRegion = searchLiveRegion;

    // Create live region for filter changes
    const filterLiveRegion = document.createElement('div');
    filterLiveRegion.id = 'filter-live-region';
    filterLiveRegion.setAttribute('aria-live', 'polite');
    filterLiveRegion.className = 'sr-only';

    document.body.appendChild(filterLiveRegion);
    this.elements.filterLiveRegion = filterLiveRegion;
  }

  /**
   * Announce search results to screen readers
   */
  announceSearchResults() {
    const count = this.state.filteredRepositories.length;
    const searchTerm = this.state.searchTerm;
    const language = this.state.selectedLanguage;

    let message = `Found ${count} repositories`;

    if (searchTerm) {
      message += ` matching "${searchTerm}"`;
    }

    if (language) {
      message += ` in ${language}`;
    }

    if (this.elements.searchLiveRegion) {
      this.elements.searchLiveRegion.textContent = message;
    }
  }

  /**
   * Enhanced render with accessibility updates
   */
  render() {
    // Cancel any pending animation frame
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }

    // Add filtering animation
    if (!this.state.isLoading) {
      this.animateFiltering();
    }

    // Use requestAnimationFrame for smooth rendering
    this.animationFrame = requestAnimationFrame(() => {
      const renderStart = performance.now();

      this.updateUI();
      this.animateStatsUpdate();

      // Track render performance
      const renderTime = performance.now() - renderStart;
      this.performanceMetrics.renderTimes.push(renderTime);

      // Keep only last 10 render times
      if (this.performanceMetrics.renderTimes.length > 10) {
        this.performanceMetrics.renderTimes.shift();
      }

      // Update accessibility after render
      setTimeout(() => {
        this.updateAriaLabels();
        this.announceSearchResults();
      }, 100);
    });
  }

  /**
   * Initialize performance optimizations
   */
  initializePerformanceOptimizations() {
    // Enable GPU acceleration for key elements
    this.enableGPUAcceleration();

    // Optimize images loading
    this.optimizeImageLoading();

    // Setup performance monitoring
    this.setupPerformanceMonitoring();

    // Optimize scroll performance
    this.optimizeScrollPerformance();

    // Setup memory management
    this.setupMemoryManagement();
  }

  /**
   * Enable GPU acceleration for performance-critical elements
   */
  enableGPUAcceleration() {
    const elements = [
      '.repo-card',
      '.search-input',
      '.filter-select',
      '.quick-filter-btn',
      '.loading-spinner'
    ];

    elements.forEach(selector => {
      const els = document.querySelectorAll(selector);
      els.forEach(el => {
        el.style.transform = 'translateZ(0)';
        el.style.backfaceVisibility = 'hidden';
        el.style.perspective = '1000px';
      });
    });
  }

  /**
   * Optimize image loading with lazy loading and error handling
   */
  optimizeImageLoading() {
    // Use Intersection Observer for lazy loading avatars
    if ('IntersectionObserver' in window) {
      const imageObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target;
            this.loadImage(img);
            imageObserver.unobserve(img);
          }
        });
      }, {
        rootMargin: '50px'
      });

      // Observe all avatar images
      document.querySelectorAll('.owner-avatar').forEach(img => {
        imageObserver.observe(img);
      });
    }
  }

  /**
   * Load image with error handling and fallback
   */
  loadImage(img) {
    const src = img.getAttribute('src');
    if (!src) return;

    const tempImg = new Image();
    tempImg.onload = () => {
      img.src = src;
      img.classList.add('loaded');
    };

    tempImg.onerror = () => {
      // Fallback to default avatar
      img.src = this.getDefaultAvatar();
      img.classList.add('error');
    };

    tempImg.src = src;
  }

  /**
   * Get default avatar for failed image loads
   */
  getDefaultAvatar() {
    return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='%23cbd5e1'%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/%3E%3C/svg%3E";
  }

  /**
   * Setup performance monitoring
   */
  setupPerformanceMonitoring() {
    // Monitor Core Web Vitals
    if ('PerformanceObserver' in window) {
      // Largest Contentful Paint
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        console.log('LCP:', lastEntry.startTime);
      });
      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });

      // First Input Delay
      const fidObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach(entry => {
          console.log('FID:', entry.processingStart - entry.startTime);
        });
      });
      fidObserver.observe({ entryTypes: ['first-input'] });

      // Cumulative Layout Shift
      const clsObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach(entry => {
          if (!entry.hadRecentInput) {
            console.log('CLS:', entry.value);
          }
        });
      });
      clsObserver.observe({ entryTypes: ['layout-shift'] });
    }

    // Monitor memory usage
    if ('memory' in performance) {
      setInterval(() => {
        const memory = performance.memory;
        if (memory.usedJSHeapSize > memory.jsHeapSizeLimit * 0.9) {
          console.warn('High memory usage detected');
          this.performMemoryCleanup();
        }
      }, 30000); // Check every 30 seconds
    }
  }

  /**
   * Perform memory cleanup
   */
  performMemoryCleanup() {
    // Clear old performance metrics
    this.performanceMetrics.searchTimes = this.performanceMetrics.searchTimes.slice(-5);
    this.performanceMetrics.renderTimes = this.performanceMetrics.renderTimes.slice(-5);

    // Clear any cached DOM references that might be stale
    this.refreshElementCache();

    // Force garbage collection if available
    if (window.gc) {
      window.gc();
    }
  }

  /**
   * Refresh element cache
   */
  refreshElementCache() {
    // Re-cache elements to ensure they're still valid
    const oldElements = this.elements;
    this.cacheElements();

    // Clean up any event listeners on old elements
    Object.values(oldElements).forEach(element => {
      if (element && element.removeEventListener) {
        // Remove any lingering event listeners
        element.removeEventListener('click', () => { });
      }
    });
  }

  /**
   * Setup memory management
   */
  setupMemoryManagement() {
    // Clean up on page unload
    window.addEventListener('beforeunload', () => {
      this.cleanup();
    });

    // Clean up on visibility change
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.performMemoryCleanup();
      }
    });
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    // Clear timers
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }

    // Disconnect observers
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
    }

    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
    }

    // Clear element references
    this.elements = {};
  }

  /**
   * Optimize search performance with memoization
   */
  optimizeSearch() {
    // Memoize search results
    this.searchCache = new Map();

    const originalPerformAdvancedSearch = this.performAdvancedSearch;
    this.performAdvancedSearch = (repositories, searchTerm) => {
      const cacheKey = `${searchTerm}-${repositories.length}`;

      if (this.searchCache.has(cacheKey)) {
        return this.searchCache.get(cacheKey);
      }

      const result = originalPerformAdvancedSearch.call(this, repositories, searchTerm);

      // Cache result (limit cache size)
      if (this.searchCache.size > 50) {
        const firstKey = this.searchCache.keys().next().value;
        this.searchCache.delete(firstKey);
      }

      this.searchCache.set(cacheKey, result);
      return result;
    };
  }

  /**
   * Optimize rendering with virtual scrolling for large datasets
   */
  optimizeRendering() {
    // Implement virtual scrolling if we have many repositories
    if (this.state.repositories.length > 100) {
      this.enableVirtualScrolling();
    }
  }

  /**
   * Enable virtual scrolling for large datasets
   */
  enableVirtualScrolling() {
    // Simple virtual scrolling implementation
    const container = this.elements.repositoryGrid;
    const itemHeight = 300; // Approximate card height
    const containerHeight = window.innerHeight;
    const visibleItems = Math.ceil(containerHeight / itemHeight) + 2; // Buffer

    let scrollTop = 0;
    let startIndex = 0;

    const updateVisibleItems = () => {
      const newStartIndex = Math.floor(scrollTop / itemHeight);
      const endIndex = Math.min(newStartIndex + visibleItems, this.state.filteredRepositories.length);

      if (newStartIndex !== startIndex) {
        startIndex = newStartIndex;
        this.renderVisibleItems(startIndex, endIndex);
      }
    };

    // Throttled scroll handler
    let ticking = false;
    const handleScroll = () => {
      scrollTop = window.pageYOffset;

      if (!ticking) {
        requestAnimationFrame(() => {
          updateVisibleItems();
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
  }

  /**
   * Render only visible items for virtual scrolling
   */
  renderVisibleItems(startIndex, endIndex) {
    const fragment = document.createDocumentFragment();

    for (let i = startIndex; i < endIndex; i++) {
      const repo = this.state.filteredRepositories[i];
      if (repo) {
        const card = this.createRepositoryCard(repo, i - startIndex);
        fragment.appendChild(card);
      }
    }

    this.elements.repositoryGrid.innerHTML = '';
    this.elements.repositoryGrid.appendChild(fragment);
  }

  /**
   * Add error boundaries for better error handling
   */
  addErrorBoundaries() {
    window.addEventListener('error', (event) => {
      console.error('Global error:', event.error);
      this.handleGlobalError(event.error);
    });

    window.addEventListener('unhandledrejection', (event) => {
      console.error('Unhandled promise rejection:', event.reason);
      this.handleGlobalError(event.reason);
    });
  }

  /**
   * Handle global errors gracefully
   */
  handleGlobalError(error) {
    // Show user-friendly error message
    this.showToast('Something went wrong. Please refresh the page.', 'error', 5000);

    // Log error for debugging
    console.error('Application error:', error);

    // Try to recover gracefully
    setTimeout(() => {
      if (this.state.repositories.length === 0) {
        this.retry();
      }
    }, 2000);
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics() {
    const avgSearchTime = this.performanceMetrics.searchTimes.length > 0
      ? this.performanceMetrics.searchTimes.reduce((a, b) => a + b, 0) / this.performanceMetrics.searchTimes.length
      : 0;

    const avgRenderTime = this.performanceMetrics.renderTimes.length > 0
      ? this.performanceMetrics.renderTimes.reduce((a, b) => a + b, 0) / this.performanceMetrics.renderTimes.length
      : 0;

    return {
      totalLoadTime: performance.now() - this.performanceMetrics.loadStartTime,
      averageSearchTime: avgSearchTime,
      averageRenderTime: avgRenderTime,
      repositoryCount: this.state.repositories.length,
      memoryUsage: performance.memory ? {
        used: performance.memory.usedJSHeapSize,
        total: performance.memory.totalJSHeapSize,
        limit: performance.memory.jsHeapSizeLimit
      } : null
    };
  }

  /**
   * Initialize all optimizations
   */
  initializeOptimizations() {
    this.initializePerformanceOptimizations();
    this.optimizeSearch();
    this.addErrorBoundaries();

    // Log performance metrics in development
    if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
      setTimeout(() => {
        console.log('Performance Metrics:', this.getPerformanceMetrics());
      }, 5000);
    }
  }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  const showcase = new GitHubShowcase();
  showcase.init();
});

// Export for potential testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GitHubShowcase;
}  