import { useEffect, useState } from 'react'
import { ScenarioDrawer } from './scenario/ScenarioDrawer'
import {
  getScenarioFixed,
  isVibeFixed,
  subscribeScenarioFixed,
} from './scenario/scenarioState'
import { VibeCheckDevtools } from './VibeCheckDevtools'

import {
  PromoBar as BrokenPromoBar,
  ShippingNotice as BrokenShippingNotice,
  NewsletterInvite as BrokenNewsletterInvite,
} from './shop/LateBanners'
import {
  PromoBar as FixedPromoBar,
  ShippingNotice as FixedShippingNotice,
  NewsletterInvite as FixedNewsletterInvite,
} from './shop/fixed/LateBanners'

import { Header as BrokenHeader } from './shop/Header'
import { Header as FixedHeader } from './shop/fixed/Header'

import { Hero as BrokenHero } from './shop/Hero'
import { Hero as FixedHero } from './shop/fixed/Hero'

import { ProductGrid as BrokenProductGrid } from './shop/ProductGrid'
import { ProductGrid as FixedProductGrid } from './shop/fixed/ProductGrid'

import { GlazePicker as BrokenGlazePicker } from './shop/GlazePicker'
import { GlazePicker as FixedGlazePicker } from './shop/fixed/GlazePicker'

import { StockTicker as BrokenStockTicker } from './shop/StockTicker'
import { StockTicker as FixedStockTicker } from './shop/fixed/StockTicker'

import { Reviews as BrokenReviews } from './shop/Reviews'
import { Reviews as FixedReviews } from './shop/fixed/Reviews'

import { RecentlyViewed as BrokenRecentlyViewed } from './shop/RecentlyViewed'
import { RecentlyViewed as FixedRecentlyViewed } from './shop/fixed/RecentlyViewed'

import { ProductSearch as BrokenProductSearch } from './shop/ProductSearch'
import { ProductSearch as FixedProductSearch } from './shop/fixed/ProductSearch'

import { CartPoller as BrokenCartPoller } from './shop/CartPoller'
import { CartPoller as FixedCartPoller } from './shop/fixed/CartPoller'

import { Intro } from './shop/Intro'
import { SplitStory } from './shop/SplitStory'
import { Newsletter } from './shop/Newsletter'
import { Footer } from './shop/Footer'

/** Tidewell storefront — Stilla chrome, intentional faults underneath. */
export const App = () => {
  const [fixed, setFixed] = useState(() => getScenarioFixed())

  useEffect(() => subscribeScenarioFixed(setFixed), [])

  const smooth = isVibeFixed(fixed, 'smooth')
  const light = isVibeFixed(fixed, 'light')
  const clean = isVibeFixed(fixed, 'clean')
  const findable = isVibeFixed(fixed, 'findable')
  const quotable = isVibeFixed(fixed, 'quotable')

  const PromoBar = smooth ? FixedPromoBar : BrokenPromoBar
  const ShippingNotice = smooth ? FixedShippingNotice : BrokenShippingNotice
  const NewsletterInvite = smooth ? FixedNewsletterInvite : BrokenNewsletterInvite
  const GlazePicker = smooth ? FixedGlazePicker : BrokenGlazePicker
  const StockTicker = smooth ? FixedStockTicker : BrokenStockTicker

  const Header = light ? FixedHeader : BrokenHeader
  const Hero = light ? FixedHero : BrokenHero
  const ProductGrid = light ? FixedProductGrid : BrokenProductGrid
  const Reviews = light ? FixedReviews : BrokenReviews
  const RecentlyViewed = light ? FixedRecentlyViewed : BrokenRecentlyViewed
  const ProductSearch = light ? FixedProductSearch : BrokenProductSearch
  const CartPoller = clean ? FixedCartPoller : BrokenCartPoller

  const body = (
    <>
      <PromoBar />
      <Header search={<ProductSearch />} findableFixed={findable} />
      <ShippingNotice />
      <Hero findableFixed={findable} />
      <Intro />
      <ProductGrid findableFixed={findable} />
      <SplitStory />
      <div id="glazes">
        <GlazePicker />
      </div>
      <StockTicker />
      <Reviews />
      <RecentlyViewed />
      <NewsletterInvite />
      <Newsletter findableFixed={findable} />
      <Footer findableFixed={findable} quotableFixed={quotable} />
      <CartPoller />
    </>
  )

  return (
    <>
      {quotable ? <main id="tidewell-main">{body}</main> : body}
      <ScenarioDrawer />
      <VibeCheckDevtools />
    </>
  )
}
