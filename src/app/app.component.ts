import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  computed,
  signal,
} from "@angular/core";
import { NgClass } from "@angular/common";
import {
  BackSide,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  SphereGeometry,
  TextureLoader,
  WebGLRenderer,
} from "three";

type Epoch = {
  id: string;
  title: string;
  years: string;
  city: string;
  site: string;
  image: string;
  accent: string;
};

@Component({
  selector: "app-root",
  imports: [NgClass],
  templateUrl: "./app.component.html",
  styleUrl: "./app.component.css",
})
export class AppComponent implements AfterViewInit, OnDestroy {
  @ViewChild("panoramaCanvas", { static: true })
  private readonly panoramaCanvas!: ElementRef<HTMLCanvasElement>;

  @ViewChild("panoramaHost", { static: true })
  private readonly panoramaHost!: ElementRef<HTMLElement>;

  protected readonly epochs: Epoch[] = [
    {
      id: "egipto",
      title: "Antiguo Egipto",
      years: "c. 2700-2200 a.C.",
      city: "Menfis",
      site: "Meseta de Guiza",
      image: "assets/egipto.png",
      accent: "#d6a84f",
    },
    {
      id: "grecia",
      title: "Antigua Grecia",
      years: "c. 480-404 a.C.",
      city: "Atenas",
      site: "Acropolis",
      image: "assets/grecia.png",
      accent: "#93a7d8",
    },
    {
      id: "roma",
      title: "Antigua Roma",
      years: "27 a.C.-476 d.C.",
      city: "Roma",
      site: "Foro Romano",
      image: "assets/roma.png",
      accent: "#b86d58",
    },
    {
      id: "alandalus",
      title: "Al-Andalus",
      years: "711-1492 d.C.",
      city: "Granada",
      site: "Alhambra de Granada",
      image: "assets/alandalus.png",
      accent: "#8fbf9f",
    },
    {
      id: "mongol",
      title: "Imperio Mongol",
      years: "Siglo XIII",
      city: "Karakorum",
      site: "Estepa mongola",
      image: "assets/mongolia.png",
      accent: "#c49a6c",
    },
    {
      id: "descubrimientos",
      title: "Descubrimientos",
      years: "Siglos XV-XVI",
      city: "Cádiz",
      site: "Puerto de Cádiz",
      image: "assets/descubrimientos.png",
      accent: "#6fa8b8",
    },
    {
      id: "edo",
      title: "Periodo Edo",
      years: "1603-1868",
      city: "Edo",
      site: "Castillo de Edo",
      image: "assets/edo.png",
      accent: "#c66b6b",
    },
    {
      id: "revolucion-francesa",
      title: "Revolucion Francesa",
      years: "1789",
      city: "Paris",
      site: "Bastilla",
      image: "assets/francia.png",
      accent: "#8ca7d8",
    },
    {
      id: "revolucion-industrial",
      title: "Revolucion Industrial",
      years: "c. 1760-1840",
      city: "Manchester",
      site: "Fabricas textiles",
      image: "assets/inglaterra.png",
      accent: "#9b9b8a",
    },
    {
      id: "guerra-fria",
      title: "Guerra Fria",
      years: "1947-1991",
      city: "Berlín",
      site: "Muro de Berlín",
      image: "assets/guerrafria.png",
      accent: "#d8d8d8",
    },
  ];

  protected readonly activeIndex = signal(0);
  protected readonly isDragging = signal(false);
  protected readonly activeEpoch = computed(
    () => this.epochs[this.activeIndex()],
  );

  private renderer?: WebGLRenderer;
  private scene?: Scene;
  private camera?: PerspectiveCamera;
  private sphere?: Mesh<SphereGeometry, MeshBasicMaterial>;
  private animationFrameId = 0;
  private yaw = 0;
  private pitch = 0;
  private dragStartX = 0;
  private dragStartY = 0;
  private dragStartYaw = 0;
  private dragStartPitch = 0;
  private readonly textureLoader = new TextureLoader();
  private readonly resizeObserver = new ResizeObserver(() =>
    this.resizeRenderer(),
  );

  ngAfterViewInit(): void {
    this.createPanorama();
    this.loadPanoramaTexture(this.activeEpoch().image);
    this.resizeObserver.observe(this.panoramaHost.nativeElement);
    requestAnimationFrame(() => {
      this.resizeRenderer();
      this.animate();
    });
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.animationFrameId);
    this.resizeObserver.disconnect();
    this.sphere?.geometry.dispose();
    this.sphere?.material.map?.dispose();
    this.sphere?.material.dispose();
    this.renderer?.dispose();
  }

  protected selectEpoch(index: number): void {
    this.activeIndex.set(index);
    this.yaw = 0;
    this.pitch = 0;
    this.loadPanoramaTexture(this.epochs[index].image);
  }

  protected startDrag(event: PointerEvent): void {
    this.isDragging.set(true);
    this.dragStartX = event.clientX;
    this.dragStartY = event.clientY;
    this.dragStartYaw = this.yaw;
    this.dragStartPitch = this.pitch;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }

  protected drag(event: PointerEvent): void {
    if (!this.isDragging()) {
      return;
    }

    const movementX = event.clientX - this.dragStartX;
    const movementY = event.clientY - this.dragStartY;

    this.yaw = this.dragStartYaw + movementX * 0.003;
    this.pitch = this.clamp(this.dragStartPitch + movementY * 0.003, -1.2, 1.2);
  }

  protected endDrag(event: PointerEvent): void {
    this.isDragging.set(false);
    (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
  }

  private createPanorama(): void {
    const canvas = this.panoramaCanvas.nativeElement;

    this.scene = new Scene();
    this.camera = new PerspectiveCamera(115, 1, 0.1, 1000);
    this.renderer = new WebGLRenderer({
      antialias: true,
      alpha: false,
      canvas,
      powerPreference: "high-performance",
    });
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 3));

    const geometry = new SphereGeometry(500, 96, 64);
    const material = new MeshBasicMaterial({
      side: BackSide,
    });

    this.sphere = new Mesh(geometry, material);
    this.scene.add(this.sphere);
    this.resizeRenderer();
  }

  private loadPanoramaTexture(image: string): void {
    if (!this.sphere) {
      return;
    }

    this.textureLoader.load(image, (texture) => {
      texture.colorSpace = SRGBColorSpace;
      texture.minFilter = LinearFilter;
      texture.magFilter = LinearFilter;
      texture.generateMipmaps = false;
      texture.anisotropy = this.renderer?.capabilities.getMaxAnisotropy() ?? 1;
      texture.needsUpdate = true;

      const previousTexture = this.sphere?.material.map;
      if (this.sphere) {
        this.sphere.material.map = texture;
        this.sphere.material.needsUpdate = true;
      }
      previousTexture?.dispose();
      this.resizeRenderer();
    });
  }

  private resizeRenderer(): void {
    const canvas = this.panoramaCanvas.nativeElement;
    const container = this.panoramaHost.nativeElement;
    const width = container?.clientWidth ?? canvas.clientWidth;
    const height = container?.clientHeight ?? canvas.clientHeight;

    if (!width || !height || !this.renderer || !this.camera) {
      return;
    }

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  private animate(): void {
    this.animationFrameId = requestAnimationFrame(() => this.animate());

    if (!this.camera || !this.renderer || !this.scene) {
      return;
    }

    this.camera.rotation.order = "YXZ";
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
    this.renderer.render(this.scene, this.camera);
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }
}
