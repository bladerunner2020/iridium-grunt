# Grunt-скрипт для сборки проекта i3pro Iridium Mobile

## Введение

Данный проект предназначен для автоматической сборки проектов **i3pro Iridium Mobile**. Он позволяет создавать скрипты для проектов **Iridium Mobile** во внешних IDE-средах (например, WebStorm), создавать универсальные js-модули, которые можно использовать в разных проектах, использовать механизм контроля версий, автоматической нумерации версий проекта и билда, сборки проекта из различных IDE.

### Требования
На компьютере должны быть установлены:
- Node JS и NPM ([www.nodejs.org](http://wwww.nodejs.org))
- Git ([git-scm.org](https://git-scm.com))
- Grunt ([gruntjs.com/](https://gruntjs.com))
- Python ([python.org](https://www.python.org))

### Файловая структура проекта

Файловая структура проекта должна выглядеть следующим образом:

```
GreatIridiumProject
│   gruntfile.js
│   package.json
│
└─── project
│   │   GreatIridiumProject.irpz
│
└─── scripts
│   │   localscript1.js
│   │   localscript2.js
│   │   ...
│
└─── temp
│
└─── build
│
└─── node_modules

```

В корень проекта помещаются файлы **gruntfile.js** и **package.json**, в папку **project** нужно положить файл с проектом **.irpz** или **.sirpz** (начиная с версии 2.x в папке  **project** должен быть только одни файл), в папку **scripts** вы помещаете локальные скрипты проекта.

Список локальных скриптов проекта должен быть прописан в файле **package.json** в раздел **projectScripts**. Глобальные скрипты и модули помещаются в раздел **dependencies** (требование к таким модулям: они должны содержать весь код в файле **index.js** в корне папки модуля и должны быть написаны специально для Iridium). Начиная с версии 2.2.x файлы могут называться не обязательно **index.js**, если в **package.json** указано название скрипта в поле **main**. Порядок модулей используется тот, который прописан в **dependencies** или если есть раздел **dependenciesOrder** (массив имен модулей), то из него. 

Папки **temp** и **build** создаются автоматически grunt скриптом. Папка **node_modules** создается утилитой **npm**.

### Требования к проекту i3pro

В файле проекта (панельный или серверный) необходимо добавить пустой скрипт **main** (окончание .js добавляется автоматически).

Файл проекта и скрипт **main(.js)** не должны быть защищены паролем.

Файл проекта должен быть помещен в папку **project**.

Рекомендуется создать токен проекта **AppVersion** (можно назвать по-другому).


### Файл package.json

Для создания начального файла **package.json** нужно в корневой папке проекта выполнить команды:

```
npm init -y
npm install https://github.com/bladerunner2020/iridium-grunt.git --save-dev
```

При сборке проекта Iridium будут задействованы разделы **dependencies** (стандартный раздел) и **projectScripts**
(раздел добавляемый вручную).

В разделе **dependencies** будут находиться глобальные модули, которые загружаются из репозитория. Предположим есть некоторый универсальный модуль - драйвер проектора NEC, который используется в разных проектах. Для установки этого модуля используется команда:

 ```
 npm install <git repo url> --save
 ```

Здесь **git repo url** будет вести к git-репозиторию, где хранится модуль. После запуска этой команды модуль будет загружен из репозитория в папку **node_modules** и добавлен в раздел **dependencies** файла **package.json**.

В разделе **projectScripts** ()создается в файле **package.json** вручную) нужно прописать все локальные скрипты, которые помещаются в папку **scripts**.

 ```json
  "projectScripts": [
    "scripts/localscript1.js",
    "scripts/localscript2.js",
    ...
  ]
   ```

Если предполагается, что модули зависят друг от друга важно соблюсти правильную последовательность модулей в разделах **dependencies** и **projectScripts**.

В разделе **devDependencies** находятся js-модули, которые используются для работы **grunt**.

### Файл gruntfile.js

В корне проекта необходимо создать файл **gruntfile.js**:

```javascript
module.exports = function(grunt) {
    var IridiumGrunt = require('iridium-grunt');
    new IridiumGrunt(grunt);
};
```

### Принцип работы

Сборка проекта осуществляется следующим образом:
- удаляется содержимое папок **temp** и **build**
- увеличивается номер версии в файле **package.json**
- файл проекта **.irpz** или **.sirpz** копируется в папку **temp**, переименовывается в **.zip** и разархивируется
- берутся файлы **index.js** из глобальных модулей (находятся в **node_modules/<iridium_module>**) и локальные скрипты и объединяется в файл **main.js**, который помещается в папку **temp/scripts/**
- в **main.js** ищутся строки **'{{ VERSION }}'** и **'{{ BUILD_VERSION }}'**, которые заменяется на текущую версию и номер билда из **package.json** (для использования номера билда нужно добавить строчку `"build": 1` в **package.json**, после чего номер билда будет увеличиваться с каждой сборкой проекта).
- проект в папке **temp** архивируется в zip, переименовывается в **.irpz** или **.sirpz** и копируется в папку **build**.

## Установка

1. Установить необходимое ПО (см. раздел **Требования**)
2. Сгенерировать начальный проект:
  ```bash
  npm init -y
  npm install https://github.com/bladerunner2020/iridium-grunt.git --save-dev
  ```
3. Добавить раздел **localScripts** и локальные скрипты в **package.json** и установить глобальные модули (см. выше)
4. Создать файл **gruntfile.js** в корне проекта
  ```javascript
  module.exports = function(grunt) {
      var IridiumGrunt = require('iridium-grunt');
      new IridiumGrunt(grunt);
  };
  ```
5. Создать папку **project** и поместить в него проект с расширением **.irpz** или **.sirpz** (проект должен содержать скрипт **main.js**)
6. Можно запустить сборку командой: `grunt build`

## Сборка проекта

Для сборки проекта необходимо запустить команду:

  ```bash
  grunt build
  ```

В процессе разработки иногда бывает нужным сгенерировать только скрипт **main.js**, но не собирать весь проект. Например, для отладки бывает удобней и быстрей генерировать **main.js** и копировать его в проект через буфер обмена. Для генерации только скрипта **main.js** используется команда:

  ```bash
  grunt build:script
  ```

Для сборки проекта без генерации скрипта (например, если вы внесли какие-то изменения в **main.js** для отладки):

  ```bash
  grunt build:from_temp
  ```

Для сборки релиза (при сборке релиза скрипт **main.js** делается нечитаемым, командой **uglify**):

  ```bash
  grunt build:release
  ```

## Редактирование проекта Iridium

Если нужно внести изменения в GUI, добавить драйверы и т.д., то редактируете файл **.irpz** или **.sirpz** и помещаете его в папку **project** взамен предыдущего файла. Если у вас настроен **git**, то версии проекта также будут сохраняться в репозитории.

## Команды
- `grunt build` - сборка рабочей версии проекта (версия не меняется, увеличивается build)
- `grunt build:hotfix` - сборка  версии проекта (увеличивается версия patch, увеличивается build)
- `grunt build:release` - сборка релизной версии проекта (увеличивается номер minor версии, увеличивается build)
- `grunt build:script` - сборка только скрипта **main.js**  (увеличивается номер build). На Mac OS скрипт копируется в буфер обмена.
- `grunt build:from_temp` - сборка версии проекта из папки **temp** (можно использовать после команды **build:script**)
- `grunt build:noConcat` - сборка проекта без объединения всех скриптов в одни скрипт **main.js**
- `grunt build:scriptNoDebug` - сборка скрипта с удалением всей отладочной выдачи **_Debug**
- `grunt save-dep-order` - сохраняет текущий порядок модулей в поле **dependenciesOrder**

## Отображение текущей версии проекта в i3pro

Для того чтобы сделать отображение текущей версии проекта в интерфейсе нужно:
- В проекте создать токены проекта **AppVersion** и **BuildVersion**
- В локальном скрипте (например, **app.js**) добавить следующий код:

  ```javascript
  var appVersion = '{{ VERSION }}';
  var buildVersion = '{{ BUILD_VERSION }}';
  IR.SetVariable('Global.AppVersion', 'v.' + appVersion);
  IR.SetVariable('Global.BuildVersion', 'v.' + buildVersion);
  ```

- Сделать в GUI графические элементы и связать их с токенами проекта **AppVersion** и **BuildVersion**

## История изменений

- **21.03.2021:** не проверяется и не записывается хэш модулей в *package.json* 

## Авторы
- Александр Пивоваров aka Bladerunner2020 ([pivovarov@gmail.com](mailto:pivovarov@gmail.com))
