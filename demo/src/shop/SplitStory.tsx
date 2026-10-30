export const SplitStory = () => (
  <>
    <section className="split" aria-labelledby="s1">
      <div className="split-img">
        <img
          src="/shop-assets/img/life-studio-960.webp"
          srcSet="/shop-assets/img/life-studio-480.webp 480w, /shop-assets/img/life-studio-960.webp 960w, /shop-assets/img/life-studio-1600.webp 1600w"
          sizes="(max-width: 900px) 100vw, 50vw"
          width={896}
          height={1152}
          alt="Studio light on a calm shelf"
          loading="lazy"
          decoding="async"
        />
      </div>
      <div className="split-tx">
        <h2 id="s1">The Tide Blue glaze</h2>
        <p>
          A dense, pooling blue that breaks over the rim. Holds without chalkiness. Our Harbor mug,
          Fog bowl and Moss cup all wear a version of it.
        </p>
        <a className="btn ghost" href="#shop">
          Shop Tide Blue
        </a>
      </div>
    </section>
    <section className="split rev tint" id="journal" aria-labelledby="s2">
      <div className="split-img">
        <img
          src="/shop-assets/img/life-stretch-960.webp"
          srcSet="/shop-assets/img/life-stretch-480.webp 480w, /shop-assets/img/life-stretch-960.webp 960w, /shop-assets/img/life-stretch-1600.webp 1600w"
          sizes="(max-width: 900px) 100vw, 50vw"
          width={1344}
          height={768}
          alt="Quiet outdoor light"
          loading="lazy"
          decoding="async"
        />
      </div>
      <div className="split-tx">
        <h2 id="s2">Kiln notes</h2>
        <p>
          Firing schedules, glaze tests, and what cracked on the shelf this week. Short journal
          posts from the studio.
        </p>
        <a className="btn ghost" href="#newsletter">
          Get the kiln schedule
        </a>
      </div>
    </section>
  </>
)
