import '../styles/AppHeader.scss'

function AppHeader() {
    return (
        <header>
            <div className="header-container">
                <div className="header-logo">
                    <span>Logo</span>
                </div>
                <div className="header-nav">
                    <ul>
                        <li><a href="#">Home</a></li>
                    </ul>
                </div>
            </div>
        </header>
    )
}
export default AppHeader;