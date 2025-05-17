<template>
  <div class="flex flex-col gap-1">
    <div class="flex" v-for="(option, index) in options" :key="index">
      <template v-if="typeof options[index] === 'boolean'">
        <input
          type="checkbox"
          :name="index"
          :value="true"
          :checked="option"
          @change="$emit('update:debug', { [nextLevel(index)]: $event.target.checked })"
        />
        &nbsp;{{ index }}
      </template>
      <template v-if="typeof options[index] === 'object'">
        <div class="flex flex-col">
          <div>{{ index }}</div>
          <ObjectCheckboxes 
            :options="option" 
            :level="nextLevel(index)" 
            @update:debug="(updateObj) => $emit('update:debug', updateObj)"
          />
        </div>
      </template>
    </div>
  </div>
</template>

<script>
export default {
  name: 'ObjectCheckboxes',
  props: {
    options: {
      type: Object,
      required: true,
    },
    level: {
      type: String,
      default: '',
    }
  },
  emits: ['update:debug'],

  methods: {
    nextLevel(index) {
      return this.level.length > 0 
        ? [this.level, index].join('.')
        : index;
      ;
    }
  }
}
</script>