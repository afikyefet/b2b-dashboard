import DealerSelector from './DealerSelector';
import type { FilterOptions } from '../types/dashboard.types';
import '../styles/AppHeader.scss';

interface AppHeaderProps {
    filterOptions: FilterOptions;
}

function AppHeader({ filterOptions }: AppHeaderProps) {
    return (
        <header>
            <div className="header-container">
                <div className="header-logo">
                    <span>Logo</span>
                </div>
                <div className="header-center">
                    <DealerSelector dealerNames={filterOptions.dealerNames} />
                </div>
                <div className="header-nav">
                    <ul>
                        <li><a href="#">Home</a></li>
                    </ul>
                </div>
            </div>
        </header>
    );
}
export default AppHeader;