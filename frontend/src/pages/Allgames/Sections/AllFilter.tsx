import type { ChangeEvent } from "react";

type AllFilterProps = {
  categories: string[];
  activeCategory: string;
  query: string;
  placeholder: string;
  onCategoryChange: (category: string) => void;
  onQueryChange: (query: string) => void;
  onClear: () => void;
};

function AllFilter({
  categories,
  activeCategory,
  query,
  placeholder,
  onCategoryChange,
  onQueryChange,
  onClear,
}: AllFilterProps) {
  const FIRST_ROW_COUNT = 4;
  const primaryCategories = categories.slice(0, FIRST_ROW_COUNT);
  const overflowCategories = categories.slice(FIRST_ROW_COUNT);

  const handleQueryChange = (event: ChangeEvent<HTMLInputElement>) => {
    onQueryChange(event.target.value);
  };

  const renderCategoryButton = (category: string) => (
    <button
      type="button"
      key={category}
      className={activeCategory === category ? "active" : ""}
      onClick={() => onCategoryChange(category)}
      aria-pressed={activeCategory === category}
    >
      {category === "ALL" ? "All games" : category}
    </button>
  );

  return (
    <>
      <label className="library-search">
        <svg className="library-search-icon" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="11" cy="11" r="6.5" />
          <path d="m16 16 4.5 4.5" />
        </svg>
        <input
          type="search"
          value={query}
          onChange={handleQueryChange}
          placeholder={placeholder}
          aria-label="Search games"
        />
      </label>
      <div className="category-filter" aria-label="Filter games by category">
        <div className="category-filter-rows">
          <div className="category-filter-pills category-filter-pills-primary">
            {primaryCategories.map(renderCategoryButton)}
            <button type="button" className="clear-filters" onClick={onClear}>
              <svg className="clear-filters-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 5h16l-6 7.5V19l-4 2v-8.5L4 5Z" />
              </svg>
              Clear filters
            </button>
          </div>
          {overflowCategories.length > 0 && (
            <div className="category-filter-pills category-filter-pills-secondary">
              {overflowCategories.map(renderCategoryButton)}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default AllFilter;