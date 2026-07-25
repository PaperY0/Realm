# 《藏梦书境》视觉风格圣经（STYLE BIBLE V3）

> 版本：V3.3｜中饱和柔和彩层、连续柔线与细腻水彩定版
> 日期：2026-07-25
> 状态：FINAL AUTHORITY｜全项目唯一画风权威源
> 适用范围：角色、场景、绘本分镜、网页世界、关键帧、轻度 2.5D、动画与图像生成
> 产品：藏梦书境｜一个把心事写成童话的世界

## 0. 权威声明

本文件是《藏梦书境》唯一有效的最终画风规范。

- 任何提示词、产品文档、测试记录或历史方案与本文件冲突时，以本文件为准。
- `assets/bible/v2/` 仅保留为研究记录，不得继续从其中复制画风提示词。
- 所有现行图像提示词必须包含本文件第 19 节的 V3 核心块和统一负面块。
- 画风统一不等于构图重复；角色、地点、季节和故事可以变化，但核心视觉规则不得变化。

## 1. 风格定义

《藏梦书境》的正式视觉方向为：

> **原创成年童话手绘水彩绘本**

可探索网页世界的空间转译为：

> **保持平面绘本为主体的极浅纸层世界**

它不是塑料儿童乐园，也不是电影概念图式宏大；它像一本用水彩、彩铅和蜡笔亲手画出的成年童话书：色相丰富但整体保持中饱和，水彩层次柔和、有深浅、有空气，同时保留简笔、稚拙、温柔和情绪深度。

### 1.1 不可改变的视觉优先级

```text
情绪叙事
> 角色可读性
> 稚拙手绘轮廓
> 简化色块
> 中饱和的多色童话彩层
> 柔和的浅中深关系
> 局部可见的蜡笔生命力
> 留白与空气
> 局部材质
> 轻微空间感
```

只要景观完整度、纸艺结构、材质精细度或光效开始抢夺角色与情绪的注意力，画面就已经偏离本风格。

### 1.2 风格不是这些东西

本风格不是：

- 精致日系动漫；
- 大眼萌系儿童插画；
- 商业吉祥物设计；
- 毛绒、黏土或塑料公仔；
- 光滑矢量图；
- 电影概念艺术；
- 横版游戏关卡；
- 商品纸雕、盒装剧场或微缩摄影；
- 统一滤镜覆盖的数字仿水彩；
- 对任何现有绘本角色或页面的直接复刻。

## 2. 参考图的提炼边界

用户提供的七张参考图用于观察高层视觉语言：

- 连贯完整、流畅柔和的暖棕褐色彩铅轮廓，带轻微手压变化和非织物式的缝合感；
- 高明度、中饱和度为主体、低饱和过渡与少量高饱和焦点并存的水彩块面；
- 局部彩铅、蜡笔和纸张痕迹；
- 圆润、简化、表情克制的动物角色；
- 大面积留白和不规则绘本分镜；
- 一幅图只聚焦一个动作和一种情绪；
- 季节、黄昏、星光与局部暖光的情绪表达。

### 2.1 可以借鉴

- 媒介组合；
- 线条性格；
- 明度与饱和度关系；
- 简化和留白方法；
- 情绪叙事方法；
- 局部魔法和季节色彩的使用节奏。

### 2.2 不得复制

- 蓝色小羊的造型、脸型、头身比例、服装和五官；
- 原书角色组合与关系安排；
- 原书具体分镜、构图、播放器版式和页面布局；
- 原有对白、文案、字迹和叙事句；
- 账号、水印、署名；
- 足以被识别为原书页面复刻的场景安排。

《藏梦书境》必须拥有自己的角色剪影、世界符号、地点结构和情绪隐喻。

### 2.3 V3.3 项目自有视觉锚点

项目自有、可用于后续生成校准的 V3.3 视觉锚点为：

`assets/concepts/references/world-gate-v3-3-style-target.png`

该图用于校准以下全局属性：

- 连贯完整、流畅柔和的暖棕褐色彩铅轮廓；
- 少量贴近主轮廓的淡回线和微微缝合感；
- 中饱和多色水彩与高明度柔和空气；
- 细腻、均匀、低对比、无重复压纹的水彩肌理；
- 前景较清楚、远景较浅但仍连续的线条层级；
- 局部星光与门缝亮光，不扩散为满屏特效。

使用边界：

- 它是线条、材质、色彩密度和柔和度参考，不是所有画面的构图模板；
- 新场景不得机械复制其中的门、道路、山体、花组和角色位置；
- `assets/concepts/references/world-gate-color-target-v1.png` 仅作为 V3.1 高饱和偏差历史记录，不再作为现行色彩目标；
- 当文字规则与视觉锚点出现冲突时，仍以本文件的文字规则为最终权威。

## 3. 两种受控渲染模式

### 3.1 模式 A：绘本叙事模式

用于：章节页、对话页、故事插画、回忆、分享卡、情绪关键帧。

```text
85% 平面手绘绘本
10% 局部彩铅与蜡笔
5% 局部情绪光
```

硬规则：

- 空间压平；
- 角色和关系优先；
- 允许暖白书页、手绘边框和大面积留白；
- 不使用纸层投影、景深、模型摄影或厚纸边；
- 一幅图只表达一个主要动作。

### 3.2 模式 B：可探索世界模式

用于：网页主世界、章节地图、门厅、可移动场景、轻度视差动画。

```text
70% 平面手绘绘本
20% 极浅纸层空间
10% 局部情绪光
```

硬规则：

- 最多 3–5 个空间层；
- 层间只表现约 0.5–2 mm 的视觉厚度；
- 纸层边缘只在必要重叠处可见，不给所有轮廓描白边；
- 阴影短、软、低对比，仅用于交互层分离；
- 角色始终是平面手绘角色或极浅纸偶，不能变成立体公仔；
- 观众位于绘本世界内部，不能看见桌面、展台、盒子或摄影棚。

### 3.3 两种模式共享的不可变量

- 同样的暖深棕手绘线；
- 同样的角色比例和五官简化；
- 同样的中饱和、高明度多色水彩，以及受控的低饱和过渡和高饱和焦点；
- 同样的局部水彩、彩铅和蜡笔；
- 同样的留白、叙事优先级和魔法克制；
- 同样的原创性与结构正确性要求。

## 4. 线条系统

### 4.1 颜色

默认轮廓使用暖深棕：`#68483F`。

允许根据环境小幅变化：

| 用途 | 推荐色 |
|---|---|
| 日常轮廓 | `#68483F` |
| 暖色场景 | `#764B3E` |
| 冷夜场景 | `#5D4B58` |
| 远景淡线 | `#887A70` |

禁止纯黑统一描边。

### 4.2 笔触性格

- 主体外轮廓必须连贯完整、流畅且不间断；只允许在真实遮挡关系处结束，不能无故断裂；
- 外轮廓略重，内部结构线较轻；同一条线通过柔和的彩铅压力变化产生轻微粗细差，不靠缺口、锯齿或碎线制造手绘感；
- 轮廓整体圆顺，转折柔和，禁止破碎、毛刺、像素化、锯齿状和干裂蜡笔边；
- 圆形、边框和建筑边缘可以轻微不对称，但线条仍须一笔连贯地围合主要形体；
- 允许在少数重点轮廓旁出现一条非常贴近、非常淡的回线，形成微微缝合感；它不是虚线针脚、布料缝线或织物纹理；
- 线条应主要像削尖但压力柔和的棕褐色彩铅，辅以极细水彩笔；蜡笔不作为主体轮廓工具；
- 不使用机械圆角、钢笔路径和光滑矢量曲线，但也不得为了“稚拙”故意切断线条。

### 4.3 轮廓连续性门禁

- 角色、门、树干、道路边缘、山体、花朵和核心道具的可见主轮廓应达到近乎完整的连续围合；
- 线条在缩小到正常观看尺寸后仍应读作一条柔和棕线，不能读作许多黑褐色碎点；
- 远景可以减少内部线条并降低轮廓对比，但保留下来的主要外轮廓仍应连续、平滑、方向明确；
- 色块可以轻微越线，轮廓不能被粗糙斑块吞没；
- 禁止把噪声、纸纹或颗粒叠加在线条上造成锯齿和断口。

### 4.4 细节线限制

- 一件物体最多使用 2–3 类提示笔触；
- 草、树皮、羊毛、纸页和云朵不依靠密集排线塑造；
- 远景细节必须明显少于近景；
- 角色脸部不使用鼻梁、睫毛、眼窝、复杂嘴型或写实阴影。

### 4.5 合法手绘误差与非法生成错误

允许：

- 左右轻微不对称；
- 色块略微越过轮廓；
- 局部颜色深浅不均；
- 边框与纸片边缘轻微起伏，但始终连贯。

禁止：

- 肢体数量错误；
- 手脚粘连；
- 五官漂移；
- 角色跨帧身份变化；
- 固定配件消失；
- 主轮廓破碎、锯齿、无故断线或被纹理吞没；
- 错误透视导致的结构断裂。

## 5. 形体与简化

### 5.1 形体原则

每个对象优先使用：

```text
一个清楚的外轮廓
+ 一到三个主要色块
+ 少量内部提示线
```

- 轮廓必须先于材质可读；
- 物体的辨识依靠剪影，不依靠写实细节；
- 植物、云、山、房屋和家具均需经过概括；
- 不追求真实比例、精确透视和工业设计完整度；
- 不把“简化”变成通用圆角图标风。

### 5.2 角色比例

- 角色总体矮小、圆润、略不对称；
- 头部或主要上部体块约占整体高度 40–55%；
- 四肢短小，动作幅度克制；
- 手脚可以被简化，但数量和连接必须正确；
- 站姿避免英雄式挺拔和动态夸张；
- 角色在全景中不能小到失去情绪可读性。

### 5.3 五官与表情

- 眼睛：点或短线；
- 嘴：一个极小点、短弧或不画；
- 鼻：通常省略；
- 腮红：低对比、小面积；
- 表情强度依靠姿势、距离和视线，而不是大幅面部变形；
- 常用动作：等待、坐下、靠近、低头、回望、递出、抱住、并肩走。

### 5.4 原创角色要求

每个核心角色必须具备：

- 独立剪影；
- 一个稳定的形状记忆点；
- 一个稳定的小配件或颜色关系；
- 正面、侧面、背面可识别；
- 不依赖参考书角色的羊毛、耳朵、服装或脸型建立识别。

## 6. 色彩系统

### 6.1 量化基线

根据七张参考图的整体色彩关系，项目采用以下目标：

| 场景状态 | 平均饱和度目标 | 平均明度目标 |
|---|---:|---:|
| 绘本白页、安静回忆 | 0.24–0.36 | 0.78–0.90 |
| 童话世界日常、春日 | 0.34–0.46 | 0.74–0.86 |
| 世界入口、黄昏、转折 | 0.40–0.54 | 0.70–0.83 |
| 星光、情绪高潮 | 整体 0.42–0.56，局部可到 0.62–0.70 | 0.66–0.82 |

量化值用于检查整体倾向，不要求像素级机械匹配。

### 6.2 基础色板

| 名称 | 色值 | 用途 |
|---|---|---|
| 奶油纸白 | `#F7E8C5` | 页面、云、留白、高光 |
| 蜡笔深棕 | `#69412F` | 轮廓、图框、树干 |
| 童话薰衣草紫 | `#7560A8` | 梦幻天空、夜幕 |
| 珊瑚粉橙 | `#F28B72` | 黄昏云层、情绪过渡 |
| 暖日橙 | `#F5A34A` | 道路、入口、夕阳 |
| 星光亮黄 | `#FFC928` | 门、星星、关键魔法 |
| 嫩芽黄绿 | `#A9B846` | 明亮草地与春日 |
| 叶片鲜绿 | `#7FA33D` | 树叶、灌木、生命感 |
| 森林深绿 | `#466B3C` | 少量环境暗部 |
| 湖水天蓝 | `#78B9D2` | 清晨天空、冷色平衡 |
| 山影蓝紫 | `#6878B4` | 远山与梦境空间 |
| 花朵莓粉 | `#EF7F87` | 花、心绪与小面积强调 |
| 月光奶白 | `#FFF2C8` | 柔和发光边缘 |

### 6.3 配色规则

- 全屏童话世界至少同时出现 3–5 个清楚的色相家族，例如紫、橙、黄、绿、蓝；
- 通过紫橙、蓝黄、粉绿等冷暖对比制造丰富感，不依靠黑白强对比；
- 主色保持清楚的中饱和色相，辅色必须彼此区分，不能全部灰化成米黄、灰绿和浅蓝；
- 高饱和只用于门缝、星星、花心、果实或情绪符号等焦点，通常占画面约 8–15%；
- 高于 0.60 的像素面积通常控制在全图 15–30%，不得连续覆盖天空、草地、山体和主体；
- 世界入口、黄昏和梦境仍以中饱和水彩为主体，不得把 35–60% 的画面同时推到中高饱和；
- 远景可以稍灰，但仍保留可识别的蓝紫、青蓝或紫红色相；
- 夜景使用深紫、蓝紫、珊瑚橙和亮黄，而不是黑灰；
- 禁止全局黄褐复古滤镜、单一米色调和所有颜色同时变浅；
- 紫色可以成为童话天空主色，但必须由珊瑚橙、星光黄、鲜绿和蓝色共同平衡，不能成为单色紫滤镜。

### 6.4 饱和面积、深浅与色彩过渡

- 中饱和是全世界默认状态，不等于把所有颜色降低成粉彩；紫、橙、黄、绿、蓝仍必须一眼可辨；
- 约 55–70% 的画面使用中饱和主体色，约 20–35% 使用低饱和水彩过渡、暖纸、薄云或安静远景，约 8–15% 使用高饱和焦点；
- 高于 0.60 的像素面积通常不超过 15–30%，且必须分散、局部、围绕叙事焦点；
- 每个大型色面至少有浅、中、深三级：浅层来自纸白或稀释色，中层承担主体色，深层只用于压住形体、前后关系或局部边缘；
- 相邻强色不能直接形成连续数字色带。紫与橙、粉与黄、蓝与绿之间应经过灰紫、灰粉、灰蓝、灰绿、暖纸色或彼此透明叠出的中间色；
- 色彩过渡允许回染、轻微色边、干湿不均和局部留白，但不能出现光滑空气喷枪渐变、硬合成彩虹带或全屏统一滤镜；
- 近景轮廓可保持中深暖棕，远景轮廓降低对比、变细、变软并允许局部消失，以明度差而不是黑线堆叠形成深浅。

## 7. 材质系统

### 7.1 默认比例

```text
78% 柔和、细腻、低对比的中饱和水彩大色块
17% 连贯棕褐色彩铅轮廓与少量内部线
3% 极局部柔软蜡笔或彩铅叠色
2% 暖纸底与局部情绪光
```

### 7.2 水彩

- 每个大型色面至少具有浅、中、深三档自然明度关系，但差值柔和，不形成硬切阴影；
- 水彩肌理必须细腻均匀、柔软融合、低对比；允许透明叠色、轻微色边和非常细的自然颗粒；
- 颜料变化以宽阔柔和的薄层为主，禁止粗糙碎裂的斑驳、结痂沉积、大片回水花和高反差颗粒；
- 保留少量局部纸白，但纸齿不能切碎色块或轮廓；
- 同一色面内部可以有轻微自然变化，但正常观看时首先读作完整、柔和、连续的水彩色层；
- 水彩必须服务于形体和情绪，不模糊、侵蚀或打断角色轮廓。

### 7.3 彩铅与蜡笔

彩铅用于：

- 轮廓；
- 草叶；
- 树皮；
- 纸页折痕；
- 小物件；
- 少量阴影提示。

蜡笔用于：

- 星星；
- 花朵；
- 风线；
- 心绪符号；
- 情绪高潮中的少量柔软叠色。

蜡笔只作为极局部柔软强调：用于星星、花心和少量情绪符号；彩铅负责连贯轮廓、轻柔排线和微微缝合感。可见彩铅/蜡笔纹理通常占约 8–15% 的画面，颗粒细小、边缘柔和，不能形成粗糙碎裂斑块、干裂笔触或连续噪声。

### 7.4 纸张

- 纸张底色偏暖白；
- 纹理在正常观看时细腻、轻柔、均匀可感，不能抢走轮廓；
- 禁止满屏重复、浮雕状、高频压纹；
- 不给每个物体套相同纸纹；
- 纸层模式中的切边必须温暖、纤细、略不规则。

## 8. 构图与留白

### 8.1 一图一情绪

每幅图原则上只承载：

```text
一个主要动作
+ 一种主要情绪
+ 一个象征物
+ 少量环境陪衬
```

如果移除一件装饰不会影响故事理解，就优先移除。

### 8.2 角色视觉净空

- 角色周围必须存在低细节区域；
- 不让树枝、花朵、道路或粒子穿过脸部；
- 角色与关键象征物之间的距离应能被一眼读懂；
- 群像中只突出一种主要关系。

### 8.3 留白

绘本页面建议保留约 25–45% 的纸白或低细节区域。

全屏网页场景不必出现白色页面，但必须通过以下方式保留空气：

- 低细节天空；
- 大片安静草坡；
- 雾；
- 简单道路；
- 稀疏远山；
- 角色附近的净空。

### 8.4 空间压平

- 透视允许轻微不准确；
- 山体像水彩色块或纸片叠放，不追求真实地质结构；
- 道路不使用强烈消失点制造电影纵深；
- 不使用广角畸变、航拍、英雄低机位和强景深；
- 全景中角色仍需保持可读，不得只成为比例尺。

## 9. 场景语言

### 9.1 自然环境

- 草地：大色块 + 少量短线，不逐根刻画；
- 花朵：数量有限、形状简化，避免均匀撒满；
- 树木：树冠以圆润块面概括，树干保留少量彩铅线；
- 山体：2–4 层足够，轮廓不同但不复杂；
- 云：柔软水彩块，不做写实体积云；
- 水面：少量水平色带和反射提示，不做摄影反光。

### 9.2 建筑与世界物件

- 建筑像绘本符号，不追求工程完整性；
- 门、桥、房间、书页和灯具应有轻微不对称；
- 重要物件只保留一个主要形状记忆点；
- 避免复杂机械、金属结构和高科技面板；
- 世界门必须是原创书页门，不是城堡门、游戏传送门或魔法阵。

### 9.3 公共世界与故事世界

公共世界：浅雾蓝、暖纸白、灰绿，安全、安静、可停留。

故事世界可根据主题改变季节和主色，但仍需保持：

- 同样的线条；
- 同样的角色简化；
- 同样的材质比例；
- 同样的留白；
- 同样的魔法克制。

## 10. 情绪光与魔法

### 10.1 常态光

- 柔和漫射光；
- 阴影短、淡、边缘软；
- 不使用商业摄影轮廓光；
- 不做强烈体积光和镜头炫光。

### 10.2 黄昏

- 暖橙集中在地平线、道路或关键物件；
- 灰紫和灰蓝保留空气；
- 角色脸部不被橙色完全吞没；
- 黄昏用于转折，不作为每张图默认时间。

### 10.3 魔法

- 同一画面只允许一个主要发光源；
- 发光面积通常小于画面 10–15%；
- 合法载体：门缝、星星、纸船、萤火虫、花、信物；
- 光晕边缘柔软但不形成霓虹描边；
- 禁止所有边缘发光、满天粒子、魔法符文和持续粉紫滤镜。

## 11. 文字与版式

- 默认禁止模型直接生成中文、英文或伪文字；
- 文案由后期排版系统加入；
- 对话框与图框允许手绘边缘，但文字必须保持真实可读；
- 正文与画面之间保留足够空白；
- 单页文案应短、克制、有画面感，不解释画面已经表达的内容；
- 水印、签名、账号和品牌外文字样均禁止进入生成图。

## 12. 动画与网页转译

### 12.1 微动

允许：

- 纸页轻微呼吸；
- 草叶和花朵低速摆动；
- 星光缓慢明灭；
- 角色眨眼、低头、轻微转身；
- 前后层 1–3% 的轻视差。

禁止：

- 快速弹跳；
- 高频粒子；
- 角色橡皮式变形；
- 夸张游戏反馈；
- 镜头高速推进和旋转。

### 12.2 网页层级

- 背景层：天空、雾、远山；
- 中景层：树林、房屋、世界门；
- 主叙事层：角色、道路、关键物；
- 前景层：极少量花草或纸边；
- 光效层：只覆盖关键魔法区域。

## 13. 角色一致性门禁

生成或制作角色时必须锁定：

- 剪影；
- 头身关系；
- 五官位置；
- 固定配件；
- 主辅色；
- 正侧背面识别点；
- 动作尺度。

出现以下情况必须重做：

- 跨帧头部形状明显变化；
- 配件换边、消失或变形；
- 角色突然出现动物耳朵或不属于设定的肢体；
- 平面角色变成立体玩具；
- 表情突然动漫化。

## 14. 图像生成结构

所有活动提示词使用五段式：

1. 风格权威声明；
2. V3 不可变核心块；
3. 本次角色、场景、动作与构图变量；
4. 渲染模式与技术要求；
5. V3 统一负面块。

提示词不得再次自行发明一套风格形容词。

## 15. 生成前检查

- [ ] 使用的是 V3 权威核心块；
- [ ] 已选择绘本叙事或可探索世界模式；
- [ ] 角色为项目原创角色；
- [ ] 一幅图只有一个主要动作和情绪；
- [ ] 已指定角色视觉净空；
- [ ] 主体色彩被写成中饱和，既不是褪色粉彩，也不是大面积高饱和；
- [ ] 高饱和焦点约占 8–15%，高于 0.60 的颜色没有连续覆盖大型色面；
- [ ] 大色面具有浅、中、深关系，并通过灰紫、灰粉、灰蓝、灰绿或暖纸色柔和过渡；
- [ ] 纹理被描述为局部、不均匀、低频；
- [ ] 魔法只有一个主要来源；
- [ ] 未要求模型生成文字；
- [ ] 包含统一负面块。

## 16. 生成后 100 分评分表

| 维度 | 权重 | 通过要点 |
|---|---:|---|
| 连贯手绘轮廓 | 15 | 暖棕褐、完整流畅、压力柔和、有微缝合感；无断线锯齿 |
| 角色与表情 | 15 | 原创、简化、克制、结构正确 |
| 色彩 | 12 | 中饱和多色水彩为主体；低饱和过渡；8–15% 高饱和焦点 |
| 水彩与纸张 | 10 | 大色面细腻均匀、柔软连续；8–15% 局部彩铅/蜡笔纹理；无粗糙斑驳 |
| 形体简化 | 10 | 大轮廓清楚，细节不过载 |
| 留白与密度 | 10 | 角色有净空，环境有空气 |
| 情绪叙事 | 10 | 一个动作、一种情绪、一个象征物 |
| 世界原创性 | 8 | 不复制参考书角色、构图或页面 |
| 空间扁平程度 | 5 | 无电影透视、模型摄影和厚纸雕 |
| 魔法克制 | 5 | 一个局部光源，面积有限 |

通过条件：

- 总分至少 90/100；
- 不存在第 17 节所列致命偏差。

## 17. 致命偏差

出现任意一项即不通过：

1. 复制或高度近似参考书中的蓝色小羊、页面、对白或构图；
2. 角色变成动漫脸、毛绒玩具、黏土或 3D 公仔；
3. 场景变成电影概念图、游戏关卡、纸雕商品或微缩摄影；
4. 满屏统一压纹、连续高频纹理、粗糙碎裂斑驳、重投影、强景深或过度景观细节；
5. 主轮廓破碎、锯齿、毛刺、像素化或无故断线；
6. 大面积高饱和覆盖导致无呼吸区，或色彩退化成褪色粉彩与灰米滤镜；
7. 肢体错误、身份漂移、固定物件消失；
8. 出现文字、伪文字、水印、签名或账号；
9. 魔法特效覆盖主体或成为主要内容；
10. 角色小到无法阅读动作和情绪。

## 18. 常见偏差与统一纠偏句

### 18.1 太精致、太像商业插画

```text
Reduce polished commercial illustration finish. Simplify every object into broad imperfect hand-drawn shapes. Keep visible human line hesitation and sparse internal marks.
```

### 18.2 轮廓破碎、锯齿或过于粗糙

```text
Redraw every visible primary contour as one smooth continuous warm-brown colored-pencil line. Keep gentle pressure variation and a subtle seam-like doubled touch only in a few places. Remove broken segments, jagged sawtooth edges, crusty crayon borders, dotted noise and accidental gaps.
```

### 18.3 水彩斑驳、颗粒太粗

```text
Replace rough fragmented mottling and coarse crusty pigment with fine, even, low-contrast watercolor grain. Use broad softly blended translucent washes; keep paper tooth extremely subtle and never let texture cut through a contour.
```

### 18.4 太暗、太黄褐

```text
Raise the overall value and restore warm paper white, misty blue and pale gray-green. Remove the global sepia cast; keep warm orange only near the emotional focal point.
```

### 18.5 纸纹铺满

```text
Remove uniform embossed texture and rough fragmented mottling. Keep 75–88% of large surfaces as fine, even, softly blended watercolor fields. Confine visible colored-pencil hatching and very soft crayon accents to 8–15% local areas; never let texture cut through a contour.
```

### 18.6 太鲜艳、色彩没有呼吸

```text
Reduce the area of high saturation without bleaching the palette. Keep the world clearly multi-hued and medium-saturated, reserve high saturation for 8–15% focal accents, and pass strong hue changes through muted watercolor bridge colors.
```

### 18.7 渐变太硬、没有深浅

```text
Replace hard synthetic rainbow bands with translucent watercolor overlaps and muted bridge colors. Give each large surface a soft light, middle and deep value structure; soften and partially lose distant edges.
```

### 18.8 太像电影或游戏场景

```text
Flatten the perspective into a picture-book page. Reduce dramatic depth, repeated mountain layers and cinematic lighting. Make the character-emotion relationship more important than the landscape.
```

### 18.9 太像纸雕商品

```text
Return to a flat watercolor picture-book image. Keep only extremely shallow layer separation at selected overlaps; no display base, box, tabletop, thick cut edges or product photography.
```

### 18.10 角色太萌或动漫化

```text
Replace cute anime facial design with tiny dot eyes, a minimal mouth, restrained blush and a quiet posture. No large eyes, eyelashes, expressive anime mouth or mascot posing.
```

### 18.11 特效太多

```text
Keep only one small emotional light source. Remove decorative particles, glowing outlines, magic symbols and secondary light effects.
```

## 19. V3 统一提示词核心块

以下两个标记块由同步工具复制到所有活动提示词。不得在单独提示文件中修改。

<!-- STYLE_CORE_V3:BEGIN -->
STYLE AUTHORITY — DREAMBOOK REALM V3.3 MEDIUM-SATURATION SOFT COLOR LAYERS, CONTINUOUS LINES AND DELICATE WATERCOLOR
Create an original adult fairy-tale picture-book world with medium-saturation multi-hue watercolor, soft layered color depth, continuous hand-drawn contours and quiet emotional storytelling. Draw every visible primary silhouette with one smooth continuous warm brown colored-pencil line. The contour must be complete, flowing and unbroken except where a real object occludes it. Use gentle pressure variation for slightly changing line weight, never gaps or rough fragments. A few selected contour segments may have a very close, faint parallel return stroke that creates a subtle seam-like doubled touch without becoming literal dashed stitching, textile seams or fabric texture. Keep corners rounded and organic. Do not use pure-black outlines, broken contour fragments, dotted noise, dry crusty crayon borders or jagged edges.

Build every character and object from a clear simplified silhouette, one to three broad color shapes and only a few internal marks. Characters are small, rounded and slightly asymmetrical, with short limbs, tiny dot-or-dash eyes, a minimal mouth, restrained blush and simple cartoon body language; emotion comes from posture, distance and gaze rather than polished anime acting. Handmade character comes from proportion, gentle asymmetry and colored-pencil pressure—not from interrupted lines or malformed structure.

Use three to five clearly different hue families such as lavender or violet, coral-pink or apricot-orange, golden yellow, yellow-green or leaf-green, and blue-violet, with small berry-pink, sky-blue or creamy-white accents. Keep medium average saturation as the default: ordinary fairy-world scenes about 0.34–0.46, magical entrances and colorful dusk about 0.40–0.54, and emotional climaxes about 0.42–0.56. Do not bleach the palette into pale pastel, beige or gray-green. Allocate roughly 55–70% of the image to readable medium-saturation colors, 20–35% to lower-saturation watercolor transitions, warm paper, soft clouds or quiet distance, and only 8–15% to high-saturation focal accents. Pixels above about 0.60 saturation should normally occupy no more than 15–30% of the image and must stay local around the story focus rather than covering every surface.

Paint large surfaces with broad softly blended translucent washes and fine, even, low-contrast watercolor grain. The texture should feel delicate, smooth and visually continuous at normal viewing size. Keep 75–88% of every sky, hill, mountain, path, wall or gate surface as a calm coherent watercolor field with gentle tonal variation. Confine visible colored-pencil hatching and very soft crayon accents to roughly 8–15% of the image around folds, flower centers, grass tips, stars and selected edges. Paper tooth is extremely subtle. Never use rough fragmented mottling, coarse crusty pigment, sharp granulation, large backruns, embossed patterns, pebble texture or a repeated texture stamp. Texture must never cut through, erode or break a contour.

Give each large color region a soft light, middle and deep value structure. Use thin translucent overlaps and muted bridge colors—dusty violet, muted rose, gray-blue, softened green or warm paper—to connect strong hue changes. Avoid hard synthetic rainbow bands. Foreground and focal contours remain continuous, slightly clearer and deeper; distant primary contours remain continuous but lighter and simpler, while unnecessary internal details may be omitted. Create depth through value, temperature and overlap rather than black contour stacking, cinematic lighting or realistic perspective.

Prioritize one main action, one main emotion and one symbolic object. Let the environment support the emotional moment instead of becoming a realistic grand landscape. Flatten perspective like a hand-painted cartoon picture-book page: simplified distant shapes, limited depth, no dramatic vanishing point and no photographic depth of field. Magic is local and restrained, centered on one main light event such as a golden door, star, paper boat, flower or firefly. Preserve intentional handmade softness while keeping anatomy, identity, props and spatial relationships correct.
<!-- STYLE_CORE_V3:END -->

<!-- STYLE_NEGATIVE_V3:BEGIN -->
UNIFIED NEGATIVE — DREAMBOOK REALM V3.3
Do not copy or closely reproduce the blue sheep, character proportions, faces, costumes, page layouts, panels, dialogue, captions, player interface, watermarks or recognizable compositions from the reference book. No polished anime face, large glossy eyes, eyelashes, chibi expression, commercial mascot pose, Disney-like acting or generic preschool cartoon. No plush, felt, fabric stitching, stuffing, clay, ceramic, resin, vinyl, plastic, toy figurine, polished CGI, photorealism or smooth vector art. No broken contour, accidental gap, interrupted outline, dotted outline, jagged sawtooth edge, pixelated edge, scratchy bristle edge, dry crusty crayon border, black fragmented line or noisy line texture. No literal dashed stitching, textile seam, fabric weave or sewn-toy appearance; the permitted seam-like touch is only a faint close colored-pencil return line. No rough fragmented mottling, coarse crusty pigment, harsh granulation, large cauliflower backrun, splatter field, chipped paint, cracked surface, embossed texture, pebble texture, leaf-vein texture, identical paper pattern or continuous all-over texture. No castle, game portal, magic circle, fantasy UI, cinematic concept art, epic realistic landscape, dramatic wide-angle perspective, strong depth of field, bokeh, lens flare or volumetric lighting. No thick cardboard, stacked paper sculpture, boxed paper theatre, tabletop, pedestal, visible studio, product photography or miniature-diorama display. No pale monochrome beige wash, dull gray-green world, faded all-pastel palette, global sepia filter, single-color purple filter, synthetic neon gradient, hard synthetic rainbow band, glossy digital airbrush, uniformly maximum saturation or high saturation covering every large surface. Do not remove color variety, but reserve the strongest colors for small focal accents. No decorative particle field or multiple competing magic systems. No dense realistic environmental detail, repeated mountain bands, realistic anatomy rendering or complex clothing. No malformed limbs, extra appendages, fused hands, drifting face, changing silhouette, missing fixed prop or inconsistent character identity. No text, letters, pseudo-writing, logo, signature, account name or watermark inside the generated image.
<!-- STYLE_NEGATIVE_V3:END -->

## 20. 最终判断

一张真正属于《藏梦书境》的画面应当满足：

> 即使移除角色名称、产品 Logo 和文案，人们仍能从连贯完整的暖棕褐彩铅轮廓、微微缝合感、紫橙黄绿蓝的中饱和童话彩层、细腻均匀的柔软水彩、简笔角色和克制星光中认出这是同一个世界。

最终目标不是让每张图看起来完全相同，而是让每张图都遵守同一套温柔、安静、原创且可验证的视觉规律。
