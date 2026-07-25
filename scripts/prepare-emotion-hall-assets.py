"""Prepare the layered emotion-hall assets from the supplied source images.

The extraction is intentionally local and deterministic: Pillow performs the
color-keying, boundary flood fills, alpha feathering, and PNG writes. Running
this script again replaces the same generated files with the same pixels.
"""

from __future__ import annotations

import argparse
import shutil
from collections import deque
from pathlib import Path
from typing import Callable

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT_DIR = ROOT / "src" / "assets" / "emotion-hall" / "layers"
DEFAULT_BACKGROUND = Path(
    r"C:\Users\wsy19\Documents\Tencent Files\387927913\nt_qq\nt_data\Pic\2026-07\Ori\79004466edbad2f498acef476d416299.png"
)
DEFAULT_DOORS = Path(
    r"C:\Users\wsy19\Documents\Tencent Files\387927913\nt_qq\nt_data\Pic\2026-07\Ori\6bfdd16dfb437e8387031ac09fc85181.png"
)
DEFAULT_GUARDIANS = Path(
    r"C:\Users\wsy19\AppData\Local\Temp\codex-clipboard-db8cd28b-bb74-4cc9-ac99-4a440522d740.png"
)

EMOTIONS = ("overthinking", "sadness", "anxiety", "anger", "joy")
EDGE_PADDING = 16


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--background", type=Path, default=DEFAULT_BACKGROUND)
    parser.add_argument("--doors", type=Path, default=DEFAULT_DOORS)
    parser.add_argument("--guardians", type=Path, default=DEFAULT_GUARDIANS)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    return parser.parse_args()


def require_file(path: Path) -> None:
    if not path.is_file():
        raise FileNotFoundError(f"Source image does not exist: {path}")


def open_rgb(path: Path) -> Image.Image:
    require_file(path)
    with Image.open(path) as source:
        return source.convert("RGB")


PixelPredicate = Callable[[tuple[int, int, int]], bool]


def connected_background_mask(image: Image.Image, predicate: PixelPredicate) -> bytearray:
    """Return pixels matching *predicate* and connected to the image border."""

    width, height = image.size
    pixels = image.load()
    candidates = bytearray(width * height)
    for y in range(height):
        row = y * width
        for x in range(width):
            if predicate(pixels[x, y]):
                candidates[row + x] = 1

    connected = bytearray(width * height)
    queue: deque[int] = deque()

    def seed(index: int) -> None:
        if candidates[index] and not connected[index]:
            connected[index] = 1
            queue.append(index)

    for x in range(width):
        seed(x)
        seed((height - 1) * width + x)
    for y in range(1, height - 1):
        seed(y * width)
        seed(y * width + width - 1)

    while queue:
        index = queue.popleft()
        x = index % width
        y = index // width
        for neighbor in (
            index - 1 if x else -1,
            index + 1 if x + 1 < width else -1,
            index - width if y else -1,
            index + width if y + 1 < height else -1,
            index - width - 1 if x and y else -1,
            index - width + 1 if x + 1 < width and y else -1,
            index + width - 1 if x and y + 1 < height else -1,
            index + width + 1 if x + 1 < width and y + 1 < height else -1,
        ):
            if neighbor >= 0 and candidates[neighbor] and not connected[neighbor]:
                connected[neighbor] = 1
                queue.append(neighbor)

    return connected


def has_background_neighbor(mask: bytearray, index: int, width: int, height: int) -> bool:
    x = index % width
    y = index // width
    for dy in range(-2, 3):
        for dx in range(-2, 3):
            if not dx and not dy:
                continue
            neighbor_x = x + dx
            neighbor_y = y + dy
            if 0 <= neighbor_x < width and 0 <= neighbor_y < height:
                if mask[neighbor_y * width + neighbor_x]:
                    return True
    return False


def clamp(value: float, low: float = 0.0, high: float = 1.0) -> float:
    return max(low, min(high, value))


def make_green_cutout(image: Image.Image) -> Image.Image:
    width, height = image.size
    pixels = image.load()

    def is_green_screen(pixel: tuple[int, int, int]) -> bool:
        red, green, blue = pixel
        return green >= 145 and green - max(red, blue) >= 72

    background = connected_background_mask(image, is_green_screen)
    alpha = bytearray(width * height)
    rgba_pixels = []
    for index in range(width * height):
        red, green, blue = pixels[index % width, index // width]
        if background[index]:
            alpha[index] = 0
        elif has_background_neighbor(background, index, width, height):
            green_excess = max(0, green - max(red, blue))
            alpha[index] = round(255 * clamp((green_excess - 34) / 130))
        else:
            alpha[index] = 255

        # Remove the green spill from antialiased pixels without changing
        # genuinely green artwork that remains fully opaque.
        if 0 < alpha[index] < 250:
            spill_limit = max(red, blue) + 16
            green = min(green, spill_limit)
        rgba_pixels.append((red, green, blue, alpha[index]))

    result = Image.new("RGBA", image.size)
    result.putdata(rgba_pixels)
    return result


def background_reference(image: Image.Image) -> tuple[float, float, float]:
    width, height = image.size
    pixels = image.load()
    samples: list[tuple[int, int, int]] = []
    stride_x = max(1, width // 32)
    stride_y = max(1, height // 24)
    for x in range(0, width, stride_x):
        samples.append(pixels[x, 0])
        samples.append(pixels[x, height - 1])
    for y in range(0, height, stride_y):
        samples.append(pixels[0, y])
        samples.append(pixels[width - 1, y])
    return tuple(sum(pixel[channel] for pixel in samples) / len(samples) for channel in range(3))


def color_distance(pixel: tuple[int, int, int], reference: tuple[float, float, float]) -> float:
    return sum((pixel[channel] - reference[channel]) ** 2 for channel in range(3)) ** 0.5


def make_guardian_cutout(image: Image.Image) -> Image.Image:
    width, height = image.size
    pixels = image.load()
    reference = background_reference(image)
    candidate_threshold = 34.0

    def is_paper_background(pixel: tuple[int, int, int]) -> bool:
        return color_distance(pixel, reference) <= candidate_threshold

    background = connected_background_mask(image, is_paper_background)
    alpha = bytearray(width * height)
    rgba_pixels = []
    for index in range(width * height):
        red, green, blue = pixels[index % width, index // width]
        distance = color_distance((red, green, blue), reference)
        if background[index]:
            alpha[index] = 0
        elif has_background_neighbor(background, index, width, height):
            alpha[index] = round(255 * clamp((distance - 26) / 24))
        else:
            alpha[index] = 255
        rgba_pixels.append((red, green, blue, alpha[index]))

    result = Image.new("RGBA", image.size)
    result.putdata(rgba_pixels)
    return result


def crop_with_transparent_padding(
    image: Image.Image,
    padding: int = EDGE_PADDING,
) -> Image.Image:
    alpha = image.getchannel("A")
    visible = alpha.point(lambda value: 255 if value >= 18 else 0)
    bbox = visible.getbbox()
    if bbox is None:
        raise ValueError("No foreground found in the image")

    x0 = max(0, bbox[0] - padding)
    y0 = max(0, bbox[1] - padding)
    x1 = min(image.width, bbox[2] + padding)
    y1 = min(image.height, bbox[3] + padding)
    return image.crop((x0, y0, x1, y1))


def crop_alpha_group(
    source: Image.Image,
    alpha: bytearray,
    padding: int = EDGE_PADDING,
) -> Image.Image:
    image = source.convert("RGBA")
    image.putalpha(Image.frombytes("L", image.size, bytes(alpha)))
    return crop_with_transparent_padding(image, padding)


def guardian_component_groups(image: Image.Image) -> list[Image.Image]:
    """Keep each guardian's connected foreground components together.

    The composite has a few detached ornaments and small shadows. Assigning
    every component to the nearest of the five largest body components keeps
    those details while preventing an adjacent guardian's overlapping outline
    from leaking into the current output.
    """

    alpha = image.getchannel("A")
    width, height = image.size
    active = bytearray(1 if value >= 18 else 0 for value in alpha.tobytes())
    visited = bytearray(width * height)
    components: list[tuple[int, tuple[int, int, int, int], list[int]]] = []

    for start, value in enumerate(active):
        if not value or visited[start]:
            continue
        visited[start] = 1
        queue = [start]
        pixels: list[int] = []
        x0 = x1 = start % width
        y0 = y1 = start // width
        while queue:
            index = queue.pop()
            pixels.append(index)
            x = index % width
            y = index // width
            x0 = min(x0, x)
            x1 = max(x1, x)
            y0 = min(y0, y)
            y1 = max(y1, y)
            for neighbor in (
                index - 1 if x else -1,
                index + 1 if x + 1 < width else -1,
                index - width if y else -1,
                index + width if y + 1 < height else -1,
                index - width - 1 if x and y else -1,
                index - width + 1 if x + 1 < width and y else -1,
                index + width - 1 if x and y + 1 < height else -1,
                index + width + 1 if x + 1 < width and y + 1 < height else -1,
            ):
                if neighbor >= 0 and active[neighbor] and not visited[neighbor]:
                    visited[neighbor] = 1
                    queue.append(neighbor)
        components.append((len(pixels), (x0, y0, x1 + 1, y1 + 1), pixels))

    primary = sorted(components, key=lambda component: component[0], reverse=True)[:5]
    primary.sort(key=lambda component: component[1][0])
    if len(primary) != 5:
        raise ValueError(f"Expected five guardian body components, found {len(primary)}")

    groups: list[list[tuple[int, tuple[int, int, int, int], list[int]]]] = [
        [component] for component in primary
    ]
    primary_centers = [
        (component[1][0] + component[1][2]) / 2 for component in primary
    ]
    for component in components:
        if component in primary:
            continue
        component_center = (component[1][0] + component[1][2]) / 2
        nearest_index = min(
            range(len(primary_centers)),
            key=lambda index: abs(primary_centers[index] - component_center),
        )
        left, _, right, _ = primary[nearest_index][1]
        if left - 32 <= component_center <= right + 32:
            groups[nearest_index].append(component)

    outputs: list[Image.Image] = []
    source_alpha = bytearray(alpha.tobytes())
    for group in groups:
        selected = bytearray(width * height)
        for _, _, component_pixels in group:
            for index in component_pixels:
                selected[index] = source_alpha[index]

        # Recover the low-alpha antialias pixels surrounding the selected
        # components without pulling in a neighboring body component.
        expanded = bytearray(selected)
        for index, value in enumerate(selected):
            if not value:
                continue
            x = index % width
            y = index // width
            for neighbor in (
                index - 1 if x else -1,
                index + 1 if x + 1 < width else -1,
                index - width if y else -1,
                index + width if y + 1 < height else -1,
            ):
                if neighbor >= 0 and source_alpha[neighbor]:
                    expanded[neighbor] = source_alpha[neighbor]
        outputs.append(crop_alpha_group(image, expanded))
    return outputs


def equal_bands(width: int) -> list[tuple[int, int]]:
    return [(round(width * index / 5), round(width * (index + 1) / 5)) for index in range(5)]


def save_png(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, format="PNG", optimize=False, compress_level=9)


def prepare_assets(
    background_path: Path,
    doors_path: Path,
    guardians_path: Path,
    output_dir: Path,
) -> list[Path]:
    output_dir.mkdir(parents=True, exist_ok=True)

    background_output = output_dir / "background.png"
    if background_path.resolve() != background_output.resolve():
        shutil.copyfile(background_path, background_output)

    doors = make_green_cutout(open_rgb(doors_path))
    guardians = make_guardian_cutout(open_rgb(guardians_path))
    generated = [background_output]
    for emotion, band in zip(EMOTIONS, equal_bands(doors.width)):
        path = output_dir / f"door-{emotion}.png"
        band_image = doors.crop((band[0], 0, band[1], doors.height))
        save_png(crop_with_transparent_padding(band_image), path)
        generated.append(path)
    for emotion, guardian in zip(EMOTIONS, guardian_component_groups(guardians)):
        path = output_dir / f"guardian-{emotion}.png"
        save_png(guardian, path)
        generated.append(path)
    return generated


def main() -> None:
    args = parse_args()
    generated = prepare_assets(args.background, args.doors, args.guardians, args.output_dir)
    for path in generated:
        with Image.open(path) as image:
            print(f"generated {path.relative_to(ROOT)}: {image.size[0]}x{image.size[1]} {image.mode}")


if __name__ == "__main__":
    main()
